// QA v0.63 P3 PR-3 (Lane C) — manual, not part of run-all.sh: fact card component (full / core), fact mastery
// (derived 🏆, Q3 / Q3b / Q7, W-011), source row + "▶ Practise" (Q4 / Q6 / Q8, R-010), CUI-0010, CUI-0009 + S-030
// tap targets, mixed-shell boot (factCard.js / fact.css), version / SW cache. Writes app + mockup screenshots.
//   NODE_PATH=/opt/node-tools/node_modules CHROMIUM_PATH=/opt/pw-browsers/chromium \
//     node .proj-docs/qa/scripts/2026-10-07_qa-v063.js <repo-root> <screenshot-dir> [v062-ref=5e1816f] [v057-ref=dc84cab]
// QA_ONLY=section,section limits the run.
// 2026-10-07 refresh (Lane D, S-039 plan A): the double tap guard (CUI-0011, v0.64) swallows a pointer click within
// DOUBLE_TAP_SLOP_PX / SCREEN_CHANGE_CLICK_GUARD_MS of a click that changed the view, so every click that changes the
// screen is followed by settle() = sleep(SCREEN_CHANGE_CLICK_GUARD_MS + 50) (value read from js/core/config.js) before
// the next click. boot's Similar Core Fact check opens a fixed key that always has Similar questions (fact #21's first
// source) instead of the first fact-linked question of a shuffled Exam 4. versionCheck compares against the current
// APP_VERSION instead of v0.63.
// 2026-10-07 refresh (v0.68 per-chapter fact numbers): the card id tag, Core Fact label and quiz header name a fact by
// its chapter number ("#15", "Ch 3 #15", "Fact Ch 3 #15"), not the global id; the expected text is computed here.
const { chromium } = require('playwright-core');
const { execSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');
const vm = require('vm');
const ROOT = path.resolve(process.argv[2] || '.');
const SHOT_DIR = path.resolve(process.argv[3] || '.');
const V062_REF = process.argv[4] || '5e1816f';
const V057_REF = process.argv[5] || 'dc84cab';
const PRE_CUI0009 = '0494a79';  // parent of 74f47e1 (CUI-0009)
const CUI0009 = '74f47e1';
const PRE_S030 = '98e5b43';     // parent of 4348180 (S-030)
const S030 = '4348180';
const { startPagesServer } = require(path.join(ROOT, 'tests', 'pages-server.js'));
const APP_URL = 'file://' + path.join(ROOT, 'index.html');
const launchOpts = { args: ['--no-sandbox'] };
if (process.env.CHROMIUM_PATH) launchOpts.executablePath = process.env.CHROMIUM_PATH;
let pass = 0, fail = 0;
const failures = [];
const ok = (c, m) => { if (c) { pass++; console.log('ok:', m); } else { fail++; failures.push(m); console.log('FAIL:', m); } };
const note = (...a) => console.log('  note:', ...a);
const MOBILE = { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true,
  userAgent: 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Mobile Safari/537.36' };
const shot = n => path.join(SHOT_DIR, `2026-10-07_v063_${n}.png`);
const card = id => `#studyContent .fact[data-fact-id="${id}"]`;
const CONFIG_JS = fs.readFileSync(path.join(ROOT, 'js/core/config.js'), 'utf8');
const SCREEN_CHANGE_CLICK_GUARD_MS = Number(CONFIG_JS.match(/const SCREEN_CHANGE_CLICK_GUARD_MS = (\d+)/)[1]);
const CUR_VERSION = CONFIG_JS.match(/const APP_VERSION = '([^']+)'/)[1];
const CUR_CACHE = 'lifeuk-v' + CUR_VERSION;
// v0.68: n = 1-based position among the chapter's facts in data order, independent of the app's chapterFactNumber
const STUDY_DATA = (() => { const c = {}; vm.runInNewContext(fs.readFileSync(path.join(ROOT, 'data/study.js'), 'utf8') + ';this.STUDY=STUDY;', c); return c.STUDY; })();
const FACT_NO = {};
STUDY_DATA.reduce((seen, f) => { seen[f.ch] = (seen[f.ch] || 0) + 1; FACT_NO[f.id] = { ch: f.ch, n: seen[f.ch] }; return seen; }, {});
const factIdTag = id => `#${FACT_NO[id].n}`;
const factSetLabel = id => `Fact Ch ${FACT_NO[id].ch} #${FACT_NO[id].n}`;
const sleep = ms => new Promise(r => setTimeout(r, ms));
const settle = () => sleep(SCREEN_CHANGE_CLICK_GUARD_MS + 50);
// a pointer click that changes the screen, then wait out the double tap guard before the next click
const nav = async (pg, sel) => { await pg.click(sel); await settle(); };

function watchErrors(pg) {
  const errs = [];
  pg.on('pageerror', e => errs.push('pageerror: ' + e.message));
  pg.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text()); });
  return errs;
}
const tok = (pg, name, prop = 'color') => pg.evaluate(([n, p]) => {
  const d = document.createElement('div'); d.style[p] = `var(${n})`; document.body.appendChild(d);
  const v = getComputedStyle(d)[p]; d.remove(); return v;
}, [name, prop]);
const cs = (pg, sel, props, pse) => pg.evaluate(([s, ps, pe]) => {
  const e = document.querySelector(s); if (!e) return null;
  const c = getComputedStyle(e, pe || null); return Object.fromEntries(ps.map(p => [p, c[p]]));
}, [sel, props, pse]);
async function fresh(b, w, opts = {}) {
  const ctx = await b.newContext({ viewport: { width: w, height: 844 }, ...opts }); const pg = await ctx.newPage(); const errs = watchErrors(pg);
  await pg.goto(APP_URL); await pg.evaluate(() => { localStorage.clear(); sessionStorage.clear(); }); await pg.reload();
  return { ctx, pg, errs };
}
const scrollCardTo = (pg, id, top) => pg.evaluate(([id, top]) => {
  const el = document.querySelector(`#studyContent .fact[data-fact-id="${id}"]`); window.scrollTo(0, el.getBoundingClientRect().top + scrollY - top); return scrollY;
}, [id, top]);

// ══════════ 8. version / SW ══════════
async function versionCheck(b) {
  const { base, server } = await startPagesServer(ROOT);
  try {
    const ctx = await b.newContext(); const pg = await ctx.newPage();
    await pg.goto(base);
    ok(await pg.evaluate(() => APP_VERSION) === CUR_VERSION, `APP_VERSION === ${CUR_VERSION} (js/core/config.js)`);
    ok((await pg.textContent('#appVersion')) === 'v' + CUR_VERSION, `header shows v${CUR_VERSION}`);
    await pg.evaluate(() => navigator.serviceWorker.ready);
    // poll inside the page (waitForFunction with an async predicate resolves immediately on the returned Promise)
    await pg.evaluate(async n => { for (let i = 0; i < 75; i++) { if ((await caches.keys()).includes(n)) return; await new Promise(r => setTimeout(r, 200)); } }, CUR_CACHE);
    const keys = await pg.evaluate(() => caches.keys());
    ok(keys.length === 1 && keys[0] === CUR_CACHE, `SW cache = ${CUR_CACHE} only (${keys})`);
    const cached = await pg.evaluate(async n => { const c = await caches.open(n);
      return [!!(await c.match('js/components/factCard.js')), !!(await c.match('css/components/fact.css'))]; }, CUR_CACHE);
    ok(cached[0] && cached[1], `factCard.js / fact.css are in the installed SW cache (${cached})`);
    await ctx.close();
  } finally { server.kill(); }
  const shell = fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8').match(/const SHELL = \[([\s\S]*?)\];/)[1];
  ok(/'js\/components\/factCard\.js'/.test(shell) && /'css\/components\/fact\.css'/.test(shell), 'sw.js SHELL lists factCard.js and fact.css');
  const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  const order = ['js/components/popover.js', 'js/components/factCard.js', 'js/screens/home.js'].map(s => html.indexOf(`src="${s}"`));
  ok(order.every(i => i > 0) && order[0] < order[1] && order[1] < order[2], `index.html loads factCard.js after popover.js, before screens (${order})`);
  ok(html.includes('href="css/components/fact.css"'), 'index.html links css/components/fact.css');
}

// ══════════ 1. Fact card: full / core / timeline war / purple ══════════
async function factCards(b) {
  for (const w of [390, 900]) {
    const { ctx, pg, errs } = await fresh(b, w);
    await pg.evaluate(() => localStorage.setItem('lifeuk.studyBookmarks', '{"21":true}')); await pg.reload();
    const T = { card: await tok(pg, '--card', 'backgroundColor'), shadow: await tok(pg, '--shadow-sm', 'boxShadow'), navyLight: await tok(pg, '--navy-light'),
      gold: await tok(pg, '--gold'), factBg: await tok(pg, '--fact-bg', 'backgroundColor'), redLight: await tok(pg, '--red-light'), muted: await tok(pg, '--text-muted'),
      purple: await tok(pg, '--purple'), purpleLight: await tok(pg, '--purple-light'), orange: await tok(pg, '--orange') };
    await pg.evaluate(() => { openStudy(); studySetTab('chapters'); studySetChapter(3); });
    const f = await pg.$eval(card(21), (e) => {
      const c = getComputedStyle(e); const first = e.querySelector('.fact-meta').firstElementChild; const s = e.querySelector('.stars');
      const star = e.querySelector('.fact-btn.star'); const tick = e.querySelector('.fact-btn.tick');
      return { bg: c.backgroundColor, shadow: c.boxShadow, bl: c.borderLeftColor, blw: c.borderLeftWidth,
        firstCls: first.className, firstText: first.textContent, idFs: getComputedStyle(first).fontSize, idColor: getComputedStyle(first).color,
        stars: s ? s.textContent.length : 0, starsTitle: s && s.title, svg: !!star.querySelector('svg path'), starText: star.textContent.trim(),
        starOn: star.classList.contains('on'), path: getComputedStyle(star.querySelector('path')).fill, tickText: tick.textContent.trim(),
        src: !!e.querySelector('.fact-src'), freq: !!e.querySelector('.tag.freq'), appearsX: /Appears ×/.test(e.textContent) };
    });
    ok(f.bg === T.card && f.shadow === T.shadow, `${w}: Study full card white (--card) + --shadow-sm (${f.bg} / ${f.shadow})`);
    ok(f.bl === T.navyLight && f.blw === '4px', `${w}: full card 4px --study-accent left border (${f.bl})`);
    ok(f.firstCls === 'fact-id' && f.firstText === factIdTag(21) && f.idFs === '10px' && f.idColor === T.muted, `${w}: first tag is ".fact-id" "${factIdTag(21)}" (fact 21), small muted (${f.firstText} ${f.idFs})`);
    ok(f.stars === 5 && /^Difficulty \d\/5$/.test(f.starsTitle), `${w}: starsHtml 5 stars + tooltip (${f.starsTitle})`);
    ok(f.svg && f.starText === '' && f.starOn && f.path === T.orange, `${w}: SVG bookmark (on = orange fill, no ☆/★ text)`);
    ok(f.tickText === '✓', `${w}: ✓ button`);
    ok(f.src && !f.freq && !f.appearsX, `${w}: source row present, no "Appears ×n" tag`);
    await scrollCardTo(pg, 21, 140); await pg.waitForTimeout(100);
    await pg.screenshot({ path: shot(`study-card-${w}`) });
    // timeline: war card red border
    await pg.evaluate(() => studySetTab('timeline'));
    const war = await pg.evaluate(() => { const e = document.querySelector('#studyContent .fact.war'); const c = getComputedStyle(e);
      return { bl: c.borderLeftColor, tag: !!e.querySelector('.tag.war'), src: !!e.querySelector('.fact-src'), id: e.dataset.factId, shadow: c.boxShadow }; });
    ok(war.bl === T.redLight && war.tag && war.src, `${w}: Timeline war card red-light left border, war tag, source row (#${war.id}, ${war.bl})`);
    await pg.evaluate(id => { const e = document.querySelector(`#studyContent .fact[data-fact-id="${id}"]`).closest('.tl-item') || document.querySelector(`#studyContent .fact[data-fact-id="${id}"]`); window.scrollTo(0, e.getBoundingClientRect().top + scrollY - 160); }, war.id);
    await pg.waitForTimeout(100);
    await pg.screenshot({ path: shot(`study-timeline-war-${w}`) });
    // purple only in Cantonese, every Study tab
    const purpleHits = [];
    for (const tabName of ['chapters', 'timeline', 'geo', 'people']) {
      await pg.evaluate(t => studySetTab(t), tabName);
      const hits = await pg.evaluate(P => {
        const out = [];
        for (const e of document.querySelectorAll('#screenStudy *')) {
          if (!e.getClientRects().length) continue;
          const c = getComputedStyle(e);
          for (const p of ['color', 'backgroundColor', 'borderLeftColor', 'borderTopColor', 'outlineColor']) {
            if (P.includes(c[p]) && !e.closest('.fact-yue')) out.push(`${e.tagName}.${e.className.baseVal ?? e.className}:${p}`);
          }
        }
        return [...new Set(out)];
      }, [T.purple, T.purpleLight]);
      purpleHits.push(...hits.map(h => tabName + ' ' + h));
    }
    ok(purpleHits.length === 0, `${w}: no purple in Study outside .fact-yue ${JSON.stringify(purpleHits.slice(0, 5))}`);
    // Similar core variant inside a normal Practice question
    await pg.evaluate(() => {
      leaveToHome(); pendingMode = PRACTICE_MODE; startExam(4);
      const i = state.questions.findIndex(q => FACT_BY_QKEY[qKey(q)] && FACT_BY_QKEY[qKey(q)].id === 21);
      state.current = i < 0 ? 0 : i; renderQuestion(); const q = state.questions[state.current]; q.a.forEach(a => selectOption(a));
    });
    await pg.waitForTimeout(100);
    const core = await pg.evaluate(() => { const e = document.querySelector('#similarBox .sqm-fact'); if (!e) return null; const c = getComputedStyle(e);
      const purple = [...e.querySelectorAll('*')].filter(x => getComputedStyle(x).color === getComputedStyle(e.querySelector('.sqm-fact-yue')).color).map(x => x.className);
      return { core: e.classList.contains('core'), bg: c.backgroundColor, bl: c.borderLeftColor, blw: c.borderLeftWidth, radius: c.borderTopLeftRadius,
        label: e.querySelector('.sqm-fact-label').textContent, btns: e.querySelectorAll('button, .fact-btn').length, src: !!e.querySelector('.fact-src, .fact-practise'),
        yue: getComputedStyle(e.querySelector('.sqm-fact-yue')).color, en: getComputedStyle(e.querySelector('.sqm-fact-en')).color, purple, shadow: c.boxShadow }; });
    ok(core && core.core && core.bg === T.factBg && core.bl === T.gold && core.blw === '4px' && core.radius === '10px', `${w}: Similar Core Fact = gold (.sqm-fact.core, --fact-bg, 4px gold border) ${JSON.stringify(core)}`);
    ok(core && /Core Fact Ch \d+ #\d+/i.test(core.label) && core.btns === 0 && !core.src, `${w}: Core Fact "${core && core.label}": no buttons, no source row`);
    ok(core && core.yue === T.purple && core.en !== T.purple && core.purple.every(c => c === 'sqm-fact-yue'), `${w}: Core Fact purple only on Cantonese line (${core && core.purple})`);
    await pg.locator('#similarBox').scrollIntoViewIfNeeded();
    await pg.locator('#similarBox').screenshot({ path: shot(`similar-core-${w}`) });
    ok(errs.length === 0, `${w}: fact cards — no page / console errors ` + errs.join('|'));
    await ctx.close();
  }
}

// ══════════ 2. Mastery ══════════
async function mastery(b) {
  for (const w of [390, 900]) {
    const { ctx, pg, errs } = await fresh(b, w);
    // #3 (Ch 2) every source 🏆 → derived; #21 (Ch 3) partial: src[0] 3, src[1] 1, rest none; #4 ticked by hand; #5 bookmarked
    // #6: ticked by hand AND every source 🏆 (S-032 case)
    const seed = await pg.evaluate(() => {
      const f = id => STUDY.find(x => x.id === id); const st = {};
      f(3).src.forEach(k => { st[k] = 3; }); f(6).src.forEach(k => { st[k] = 3; });
      st[f(21).src[0]] = 3; st[f(21).src[1]] = 1;
      localStorage.setItem('lifeuk.practiceStreak', JSON.stringify(st));
      localStorage.setItem('lifeuk.studyMastered', JSON.stringify({ 4: true, 6: true }));
      localStorage.setItem('lifeuk.studyBookmarks', JSON.stringify({ 5: true, 3: true }));
      return { st, ch: [3, 4, 5, 6, 21].map(id => [id, f(id).ch, f(id).src.length]) };
    });
    note(`${w}: seed`, JSON.stringify(seed.ch));
    await pg.reload();
    const w011 = await pg.evaluate(() => factMastery({ src: [] }));
    ok(w011.derived === false && w011.total === 0 && w011.mastered === 0, `W-011 factMastery({src:[]}).derived === false (${JSON.stringify(w011)})`);
    ok(await pg.evaluate(() => STUDY.every(f => Array.isArray(f.src) && f.src.length > 0)), 'data: every one of 236 facts has ≥ 1 source question');
    // independent expected count from raw storage (not the app's helpers)
    const expected = () => pg.evaluate(() => {
      const st = JSON.parse(localStorage.getItem('lifeuk.practiceStreak') || '{}'); const man = JSON.parse(localStorage.getItem('lifeuk.studyMastered') || '{}');
      return STUDY.filter(f => man[f.id] || f.src.every(k => (st[k] || 0) >= 3)).length;
    });
    // via the real Home → Study button
    await nav(pg, '#modeStudy');
    await pg.click('.study-tab[data-tab="chapters"]');
    await pg.click('#studySubChips .chip[data-arg="2"]');
    const progress = await pg.textContent('#studyProgress');
    const exp = await expected();
    ok(progress === `🏆 ${exp} / 236 mastered` && exp === 3, `${w}: header "${progress}" = independent count ${exp} (#3 derived, #4 ticked, #6 both)`);
    const look = id => pg.$eval(card(id), e => {
      const tk = e.querySelector('.fact-btn.tick');
      return { mastered: e.classList.contains('mastered'), op: getComputedStyle(e).opacity, trophy: tk.classList.contains('trophy'), text: tk.textContent.trim(),
        ad: tk.getAttribute('aria-disabled'), action: tk.getAttribute('data-action'), title: tk.title, pressed: tk.getAttribute('aria-pressed'),
        cursor: getComputedStyle(tk).cursor, nodes: [...e.querySelectorAll('.fact-src .sqm-node')].map(n => n.className.replace('sqm-node', '').trim() || 'none') };
    });
    const d3 = await look(3), m4 = await look(4), b5 = await look(5), d6 = await look(6);
    ok(!b5.mastered && !b5.trophy && b5.text === '✓' && b5.op === '1' && b5.nodes.every(n => n === 'none'), `${w}: not practised (#5): ✓, full opacity, grey nodes (${JSON.stringify(b5)})`);
    ok(d3.mastered && d3.trophy && d3.text === '🏆' && d3.ad === 'true' && d3.action === null && d3.cursor === 'default' && d3.title.startsWith('🏆 Mastered'),
      `${w}: derived (#3): 🏆 aria-disabled, no data-action, default cursor, tooltip (${JSON.stringify(d3)})`);
    ok(d3.nodes.every(n => n === 'mastered'), `${w}: derived (#3) nodes all 🏆 green (${d3.nodes})`);
    ok(m4.mastered && !m4.trophy && m4.pressed === 'true' && m4.op === d3.op, `${w}: manual tick (#4) dims the same as derived (Q7: ${m4.op} / ${d3.op})`);
    ok(d6.trophy && d6.mastered, `${w}: ticked + derived (#6) shows 🏆 (S-032)`);
    // real clicks on 🏆: mouse + keyboard → nothing changes
    const before = await pg.evaluate(() => [localStorage.getItem('lifeuk.studyMastered'), localStorage.getItem('lifeuk.studyBookmarks')]);
    const box = await pg.locator(`${card(3)} .fact-btn.trophy`).boundingBox();
    await pg.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
    await pg.focus(`${card(3)} .fact-btn.trophy`); await pg.keyboard.press('Enter'); await pg.keyboard.press('Space');
    const after = await pg.evaluate(() => [localStorage.getItem('lifeuk.studyMastered'), localStorage.getItem('lifeuk.studyBookmarks')]);
    const d3b = await look(3);
    ok(JSON.stringify(after) === JSON.stringify(before) && d3b.trophy && d3b.mastered, `${w}: mouse click + Enter + Space on 🏆 change nothing, no storage write (${after[0]})`);
    await scrollCardTo(pg, 3, 140); await pg.waitForTimeout(100);
    await pg.screenshot({ path: shot(`mastery-ch2-${w}`) });
    // partial (#21 in Ch 3): 🔥 / 🏆 node colours, not mastered
    await pg.click('#studySubChips .chip[data-arg="3"]');
    const p21 = await look(21);
    const nodeCols = await pg.$$eval(`${card(21)} .sqm-node`, ns => ns.map(n => getComputedStyle(n).backgroundColor));
    ok(!p21.mastered && !p21.trophy && p21.nodes[0] === 'mastered' && p21.nodes[1] === 'weak' && p21.nodes.slice(2).every(n => n === 'none'),
      `${w}: partial (#21): not mastered, nodes 🏆 / 🔥 / grey (${p21.nodes})`);
    ok(new Set(nodeCols.slice(0, 3)).size === 3, `${w}: mastered / weak / untried nodes have three different colours (${nodeCols.slice(0, 3)})`);
    await scrollCardTo(pg, 21, 140); await pg.waitForTimeout(100);
    await pg.screenshot({ path: shot(`mastery-partial-${w}`) });
    // Hide mastered hides derived + ticked
    await pg.click('#studySubChips .chip[data-arg="2"]');
    const total = await pg.$$eval('#studyContent .fact', es => es.length);
    await pg.click('#studyChips .chip[data-arg="hideMastered"]');
    const hidden = await pg.evaluate(() => ({ ids: [...document.querySelectorAll('#studyContent .fact')].map(e => +e.dataset.factId), count: byId('studyCount').textContent }));
    ok(![3, 4, 6].some(id => hidden.ids.includes(id)) && hidden.ids.includes(5) && hidden.ids.length === total - 3, `${w}: Hide mastered hides #3 (derived), #4, #6 (ticked) — ${hidden.count}`);
    await pg.click('#studyChips .chip[data-arg="hideMastered"]');
    // Home "Reset practice progress" via the UI
    await nav(pg, '#screenStudy .back-btn');
    await pg.click('[data-action="resetPracticeProgress"]');
    await pg.click('#confirmOk');
    const ls = await pg.evaluate(() => [localStorage.getItem('lifeuk.practiceStreak'), localStorage.getItem('lifeuk.studyMastered'), localStorage.getItem('lifeuk.studyBookmarks')]);
    ok(ls[0] === '{}' && ls[1] === before[0] && ls[2] === before[1], `${w}: Reset practice progress clears streaks, keeps Study ticks + bookmarks (${ls})`);
    await nav(pg, '#modeStudy');
    const r3 = await look(3), r4 = await look(4), r6 = await look(6);
    const prog2 = await pg.textContent('#studyProgress');
    ok(!r3.mastered && !r3.trophy && r3.text === '✓' && r3.pressed === 'false', `${w}: after reset derived 🏆 on #3 gone, back to ✓`);
    ok(r4.mastered && r6.mastered && !r6.trophy && r6.pressed === 'true', `${w}: after reset manual ticks (#4, #6) kept; #6 shows its ✓ again`);
    ok(prog2 === `🏆 ${await expected()} / 236 mastered` && prog2 === '🏆 2 / 236 mastered', `${w}: header after reset "${prog2}"`);
    ok(errs.length === 0, `${w}: mastery — no page / console errors ` + errs.join('|'));
    await ctx.close();
  }
}

// ══════════ 3. Source row + Practise ══════════
async function sourceRow(b) {
  for (const w of [390, 900]) {
    const { ctx, pg, errs } = await fresh(b, w);
    // every fact in every chapter: node count / text = f.src, button text, aria, no Appears ×
    const all = await pg.evaluate(() => {
      openStudy(); studySetTab('chapters'); const bad = []; let n = 0;
      for (const ch of CHAPTERS) {
        studySetChapter(ch);
        for (const e of document.querySelectorAll('#studyContent .fact')) {
          n++; const f = STUDY.find(x => x.id === +e.dataset.factId);
          const nodes = [...e.querySelectorAll('.fact-src .sqm-node')].map(x => x.textContent);
          const want = f.src.map(k => { const [ex, i] = k.split('.'); return `E${ex}·Q${+i + 1}`; });
          const btn = e.querySelector('.fact-practise');
          const label = f.src.length === 1 ? '▶ Practise this one' : `▶ Practise these ${f.src.length}`;
          if (nodes.join() !== want.join() || btn.textContent !== label || btn.dataset.action !== 'startFactPractice' || btn.dataset.arg !== String(f.id)
            || btn.getAttribute('aria-describedby') !== `factId${f.id}` || !document.getElementById(`factId${f.id}`) || /Appears ×/.test(e.textContent)
            || e.querySelector('.fact-src .sqm-map-label').textContent !== 'Appears in:') bad.push(f.id);
        }
      }
      return { n, bad, ones: STUDY.filter(f => f.src.length === 1).length };
    });
    ok(all.n === 236 && all.bad.length === 0, `${w}: all 236 cards: nodes = f.src (E·Q text, order), Practise label / action / aria-describedby (bad ${all.bad.slice(0, 5)}; ${all.ones} one-source facts)`);
    // nodes are display-only: click each node on #21
    await pg.evaluate(() => { studySetChapter(3); });
    await scrollCardTo(pg, 21, 140);
    const nodeInfo = await pg.$$eval(`${card(21)} .sqm-node`, ns => ns.map(n => ({ tag: n.tagName, action: n.getAttribute('data-action'), tab: n.tabIndex, cursor: getComputedStyle(n).cursor })));
    ok(nodeInfo.length === 8 && nodeInfo.every(n => n.tag === 'SPAN' && n.action === null && n.tab === -1 && n.cursor !== 'pointer'), `${w}: #21 has 8 display-only nodes (span, no action, not focusable, no pointer)`);
    const y0 = await pg.evaluate(() => scrollY);
    for (let i = 0; i < nodeInfo.length; i++) await pg.locator(`${card(21)} .sqm-node >> nth=${i}`).click();
    const afterNodes = await pg.evaluate(() => ({ screen: document.querySelector('.screen.active').id, ret: sessionReturn, y: scrollY }));
    ok(afterNodes.screen === 'screenStudy' && afterNodes.ret === null && afterNodes.y === y0, `${w}: clicking every node does nothing (${JSON.stringify(afterNodes)})`);
    // layout of #21 (8 nodes) and a one-source fact
    const lay = await pg.$eval(card(21), e => {
      const r = e.getBoundingClientRect(); const btn = e.querySelector('.fact-practise').getBoundingClientRect();
      const nodes = [...e.querySelectorAll('.sqm-node')].map(n => n.getBoundingClientRect());
      return { wrap: e.querySelector('.fact-src').classList.contains('wrap-btn'), cardL: r.left, cardR: r.right, btnW: btn.width, btnL: btn.left, btnR: btn.right, btnTop: btn.top,
        nodesMaxBottom: Math.max(...nodes.map(n => n.bottom)), nodeRows: new Set(nodes.map(n => Math.round(n.top))).size,
        overflow: nodes.some(n => n.right > r.right - 14 + 0.5 || n.left < r.left),
        overlap: nodes.some(n => n.right > btn.left && n.left < btn.right && n.bottom > btn.top && n.top < btn.bottom), btnInCard: btn.right <= r.right - 14 + 0.5, docW: document.documentElement.scrollWidth, btnH: btn.height };
    });
    note(`${w}: #21 layout`, JSON.stringify(lay));
    ok(lay.wrap && !lay.overflow && !lay.overlap && lay.btnInCard && lay.docW <= w && (w > 480 || lay.btnTop >= lay.nodesMaxBottom),
      `${w}: #21 8 nodes inside the card, no overlap with the button, no horizontal scroll${w <= 480 ? ', button on its own line below' : ''} (${lay.nodeRows} node rows)`);
    if (w === 390) ok(Math.abs(lay.btnR - lay.btnL - (lay.cardR - lay.cardL - 4 - 28)) <= 1, `390: #21 Practise button full width of the card content (${lay.btnW})`);
    else ok(lay.btnW < 200, `900: #21 Practise button not full width (${lay.btnW})`);
    await pg.screenshot({ path: shot(`source-row-21-${w}`) });
    const one = await pg.evaluate(() => { const f = STUDY.find(x => x.src.length === 1); studySetChapter(f.ch); const e = document.querySelector(`#studyContent .fact[data-fact-id="${f.id}"]`);
      window.scrollTo(0, e.getBoundingClientRect().top + scrollY - 140);
      return { id: f.id, text: e.querySelector('.fact-practise').textContent, wrap: e.querySelector('.fact-src').classList.contains('wrap-btn'), nodes: e.querySelectorAll('.sqm-node').length }; });
    ok(one.text === '▶ Practise this one' && !one.wrap && one.nodes === 1, `${w}: one-source fact #${one.id}: "▶ Practise this one", inline (${JSON.stringify(one)})`);
    await pg.waitForTimeout(100);
    await pg.screenshot({ path: shot(`source-row-one-${w}`) });
    ok(errs.length === 0, `${w}: source row — no page / console errors ` + errs.join('|'));
    await ctx.close();
  }
}

// answer the current fact-session question with real clicks; correct or not
async function answerByClick(pg, correct) {
  const picks = await pg.evaluate(c => { const q = state.questions[state.current];
    if (c) return [...q.a]; const wrong = q.o.map((_, i) => i).filter(i => !q.a.includes(i)); return wrong.slice(0, q.a.length).concat(q.a).slice(0, q.a.length); }, correct);
  for (const p of picks) await pg.click(`#opt${p}`);
  return pg.evaluate(() => state.current in state.revealed);
}

async function practiseFlow(b) {
  for (const w of [390, 900]) {
    const { ctx, pg, errs } = await fresh(b, w);
    const T = { gold: await tok(pg, '--gold') };
    // Home left in Exam mode; Study › Chapters › Ch 3, search for a word in fact #21
    await pg.click('#modeExam'); await settle();
    const word = 'the'; // matches #21 and most facts, so the list stays long enough to scroll
    await nav(pg, '#modeStudy');
    await pg.click('.study-tab[data-tab="chapters"]');
    await pg.click('#studySubChips .chip[data-arg="3"]');
    const preAll = await pg.textContent('#studyCount');
    await pg.fill('#studySearch', word);
    const pre = await pg.evaluate(() => ({ tab: study.tab, ch: study.chapter, search: study.search, count: byId('studyCount').textContent }));
    note(`${w}: search "${word}" → ${pre.count} (was ${preAll})`);
    const preY = await scrollCardTo(pg, 21, 300);
    const preNodes = await pg.$$eval(`${card(21)} .sqm-node`, ns => ns.map(n => n.className));
    await nav(pg, `${card(21)} .fact-practise`);
    const s = await pg.evaluate(() => ({ screen: document.querySelector('.screen.active').id, mode: state.mode, pending: pendingMode, timer: examTimerId,
      timerHidden: byId('examTimer').hidden || getComputedStyle(byId('examTimer')).display === 'none', label: byId('quizLabel').textContent, badge: byId('modeBadge').textContent,
      n: state.questions.length, qnum: byId('qNum').textContent, keys: state.questions.map(qKey).join(), src: STUDY.find(f => f.id === 21).src.join(), ret: sessionReturn }));
    ok(s.screen === 'screenQuiz' && s.mode === 'practice' && s.pending === 'exam' && s.timer === null && s.timerHidden && s.badge === 'Practice',
      `${w}: real click Practise with Home on Exam → Practice, no timer (${JSON.stringify({ mode: s.mode, pending: s.pending, timer: s.timer, badge: s.badge })})`);
    ok(s.label === factSetLabel(21) && s.n === 8 && s.qnum.startsWith('Question 1 of 8') && s.keys === s.src, `${w}: header "${s.label}", ${s.qnum}, questions = f.src order`);
    ok(s.ret && s.ret.kind === 'study' && s.ret.factId === 21 && Math.abs(s.ret.scrollY - preY) <= 1, `${w}: sessionReturn ${JSON.stringify(s.ret)}`);
    await pg.screenshot({ path: shot(`fact-session-q1-${w}`) });
    const pattern = [true, false, true, true, false, true, true, true];
    for (let i = 0; i < 8; i++) {
      const rev = await answerByClick(pg, pattern[i]);
      const sim = await pg.evaluate(() => byId('similarBox').classList.contains('show'));
      if (!rev || sim) ok(false, `${w}: Q${i + 1} revealed=${rev} similar=${sim}`);
      if (i < 7) await pg.click('#nextBtn');
    }
    const st = await pg.evaluate(() => { const s = JSON.parse(localStorage.getItem('lifeuk.practiceStreak') || '{}'); return STUDY.find(f => f.id === 21).src.map(k => s[k]); });
    ok(st.every((v, i) => v === (pattern[i] ? 1 : 0)), `${w}: real answers write practiceStreak for all 8 (${st})`);
    ok(await pg.textContent('#nextBtn') === '↩ Back' && await pg.textContent('#quickNext') === '↩', `${w}: last question ↩ Back / ↩`);
    await pg.screenshot({ path: shot(`fact-session-last-${w}`) });
    await pg.click('#nextBtn');
    const post = await pg.evaluate(id => { const e = document.querySelector(`#studyContent .fact[data-fact-id="${id}"]`); const r = e.getBoundingClientRect();
      return { screen: document.querySelector('.screen.active').id, tab: study.tab, ch: study.chapter, search: study.search, box: byId('studySearch').value,
        count: byId('studyCount').textContent, y: scrollY, flash: e.classList.contains('flash'), outline: getComputedStyle(e).outlineColor, outlineW: getComputedStyle(e).outlineWidth,
        inView: r.top >= 0 && r.bottom <= innerHeight, ret: sessionReturn, activeChip: document.querySelector('#studySubChips .chip.active')?.dataset.arg,
        nodes: [...e.querySelectorAll('.sqm-node')].map(n => n.className) }; }, 21);
    ok(post.screen === 'screenStudy' && post.ret === null, `${w}: ↩ Back → Study, sessionReturn cleared`);
    ok(post.tab === pre.tab && post.ch === pre.ch && post.activeChip === '3' && post.search === pre.search && post.box === word && post.count === pre.count,
      `${w}: tab / chip / search / count restored (${JSON.stringify({ tab: post.tab, chip: post.activeChip, box: post.box, count: post.count })})`);
    ok(Math.abs(post.y - preY) <= 1 && post.inView, `${w}: scroll restored (${post.y} vs ${preY}), card in view`);
    ok(post.flash && post.outline === T.gold && post.outlineW === '2px', `${w}: card flashes gold outline (${post.outline} ${post.outlineW})`);
    ok(post.nodes.every((c, i) => c === (pattern[i] ? 'sqm-node weak' : 'sqm-node')) && post.nodes.join() !== preNodes.join(), `${w}: node colours updated at once (${post.nodes.map(c => c.replace('sqm-node', '').trim() || '-')})`);
    await pg.screenshot({ path: shot(`fact-session-back-flash-${w}`) });
    await pg.waitForTimeout(1200);
    const mid = await pg.$eval(card(21), e => e.classList.contains('flash'));
    await pg.waitForTimeout(450);
    const gone = await pg.$eval(card(21), e => ({ flash: e.classList.contains('flash'), outline: getComputedStyle(e).outlineStyle }));
    ok(mid && !gone.flash && gone.outline === 'none', `${w}: flash still on at 1.2s, gone by 1.65s (${JSON.stringify(gone)})`);
    // Home still on Exam: a fresh Exam from Home is timed
    ok(await pg.evaluate(() => pendingMode) === 'exam', `${w}: Home mode still Exam after the fact session`);
    // R-010: card off screen at the time the session started (keyboard / programmatic start at scrollY 0)
    await pg.fill('#studySearch', '');
    await pg.evaluate(() => { window.scrollTo(0, 0); });
    const offBefore = await pg.$eval(card(21), e => e.getBoundingClientRect().top > innerHeight);
    await pg.focus(`${card(21)} .fact-practise`);
    const yFocus = await pg.evaluate(() => scrollY);
    await pg.keyboard.press('Enter');
    const kb = await pg.evaluate(() => ({ ex: state.examNum, ret: sessionReturn && sessionReturn.scrollY }));
    ok(kb.ex === 'f21' && kb.ret === yFocus, `${w}: keyboard Enter on Practise opens Fact #21 (return scrollY ${kb.ret})`);
    await pg.evaluate(() => { state.current = state.questions.length - 1; renderQuestion(); });
    await answerByClick(pg, true);
    // force the off-screen case: overwrite the stored scroll with 0 (as if the list had changed)
    await pg.evaluate(() => { sessionReturn.scrollY = 0; });
    await pg.click('#nextBtn');
    const r10 = await pg.$eval(card(21), e => { const r = e.getBoundingClientRect(); return { top: r.top, bottom: r.bottom, vh: innerHeight, y: scrollY, flash: e.classList.contains('flash') }; });
    ok(offBefore && r10.top >= 0 && r10.bottom <= r10.vh + 1 && r10.flash, `${w}: R-010 off-screen card scrolled into view + flash (${JSON.stringify(r10)})`);
    // Hide mastered + the card leaves the list while practising: no flash, no error
    await pg.evaluate(() => { const s = JSON.parse(localStorage.getItem('lifeuk.practiceStreak') || '{}'); STUDY.find(f => f.id === 8).src.forEach(k => { s[k] = 2; }); localStorage.setItem('lifeuk.practiceStreak', JSON.stringify(s)); streaks = s; studySetChapter(STUDY.find(f => f.id === 8).ch); });
    await settle(); // ↩ Back (pointer) above returned to Study
    await pg.click('#studyChips .chip[data-arg="hideMastered"]');
    await scrollCardTo(pg, 8, 300);
    await nav(pg, `${card(8)} .fact-practise`);
    for (let i = 0; ; i++) { await answerByClick(pg, true); if (await pg.textContent('#nextBtn') === '↩ Back') break; await pg.click('#nextBtn'); }
    await nav(pg, '#nextBtn');
    const gone8 = await pg.evaluate(() => ({ screen: document.querySelector('.screen.active').id, card: !!document.querySelector('#studyContent .fact[data-fact-id="8"]'), flashes: document.querySelectorAll('.fact.flash').length }));
    ok(gone8.screen === 'screenStudy' && !gone8.card && gone8.flashes === 0, `${w}: fact mastered during its session + Hide mastered → card gone, no flash, no error (${JSON.stringify(gone8)})`);
    await pg.click('#studyChips .chip[data-arg="hideMastered"]');
    // other tabs: Timeline / People return to the same tab
    for (const tab of ['timeline', 'people', 'geo']) {
      await pg.click(`.study-tab[data-tab="${tab}"]`);
      const id = await pg.evaluate(() => +document.querySelector('#studyContent .fact').dataset.factId);
      await scrollCardTo(pg, id, 300);
      await nav(pg, `${card(id)} .fact-practise`);
      const lbl = await pg.textContent('#quizLabel');
      await pg.evaluate(() => { state.current = state.questions.length - 1; renderQuestion(); });
      await answerByClick(pg, true); await nav(pg, '#nextBtn');
      const back = await pg.evaluate(() => ({ screen: document.querySelector('.screen.active').id, tab: study.tab }));
      ok(lbl === factSetLabel(id) && back.screen === 'screenStudy' && back.tab === tab, `${w}: ${tab} tab: Practise #${id} → "${lbl}" → back to ${back.tab}`);
    }
    ok(errs.length === 0, `${w}: Practise flow — no page / console errors ` + errs.join('|'));
    await ctx.close();
  }
}

// ══════════ 4. CUI-0010 ══════════
async function cui0010(b) {
  const { ctx, pg, errs } = await fresh(b, 390);
  await nav(pg, '#modeStudy'); await pg.click('.study-tab[data-tab="chapters"]'); await pg.click('#studySubChips .chip[data-arg="3"]');
  // settle first: the session may have been opened by a pointer click / double click a moment ago
  const back = async () => { await settle(); await pg.evaluate(() => { state.current = state.questions.length - 1; renderQuestion(); }); await answerByClick(pg, true); await nav(pg, '#nextBtn');
    return pg.evaluate(() => ({ y: scrollY, screen: document.querySelector('.screen.active').id, ret: sessionReturn })); };
  // a) programmatic double call
  let y = await scrollCardTo(pg, 21, 300);
  await pg.evaluate(() => { startFactPractice(21); startFactPractice(21); });
  let r = await back();
  ok(r.screen === 'screenStudy' && Math.abs(r.y - y) <= 1, `CUI-0010 a) startFactPractice twice → back at ${r.y} (was ${y})`);
  // b) session in session with another fact
  y = await scrollCardTo(pg, 30, 300);
  await pg.evaluate(() => { startFactPractice(30); startFactPractice(21); });
  const lbl = await pg.textContent('#quizLabel');
  r = await back();
  const fl = await pg.evaluate(() => [...document.querySelectorAll('.fact.flash')].map(e => e.dataset.factId));
  ok(lbl === factSetLabel(21) && Math.abs(r.y - y) <= 1, `CUI-0010 b) Fact #30 then #21 inside it → shows #21, back at the original Study scroll ${r.y} (was ${y}); flash on ${fl}`);
  note('b) flash goes to the first fact\'s id (kept return point):', fl);
  // c) real double click on the Practise button (second click lands on the quiz screen)
  y = await scrollCardTo(pg, 21, 300);
  await pg.dblclick(`${card(21)} .fact-practise`);
  const dbl = await pg.evaluate(() => ({ ex: state.examNum, answered: Object.keys(state.answers).length, revealed: Object.keys(state.revealed).length, ret: sessionReturn.scrollY }));
  ok(dbl.ex === 'f21' && Math.abs(dbl.ret - y) <= 1, `CUI-0010 c) real double click: one session, return scroll kept (${JSON.stringify(dbl)})`);
  ok(dbl.answered === 0 && dbl.revealed === 0, `E9: double click does not answer Q1 with the second click (${JSON.stringify(dbl)})`);
  const st9 = await pg.evaluate(() => ({ streak: localStorage.getItem('lifeuk.practiceStreak'), wrong: localStorage.getItem('lifeuk.wrongList'), hit: document.activeElement && document.activeElement.id }));
  note('E9 after real double click: storage', JSON.stringify(st9));
  r = await back();
  ok(Math.abs(r.y - y) <= 1, `CUI-0010 c) back at ${r.y} (was ${y})`);
  // d) keyboard: Enter twice fast
  y = await scrollCardTo(pg, 21, 300);
  await pg.focus(`${card(21)} .fact-practise`);
  y = await pg.evaluate(() => scrollY);
  await pg.keyboard.press('Enter'); await pg.keyboard.press('Enter');
  const kb = await pg.evaluate(() => ({ ex: state.examNum, answered: Object.keys(state.answers).length, ret: sessionReturn.scrollY, cur: state.current }));
  ok(kb.ex === 'f21' && kb.ret === y, `CUI-0010 d) Enter ×2: return scroll kept (${JSON.stringify(kb)})`);
  note('d) Enter ×2 state', JSON.stringify(kb));
  r = await back();
  ok(Math.abs(r.y - y) <= 1, `CUI-0010 d) back at ${r.y} (was ${y})`);
  // e) two sessions in a row from different positions: the second one gets its own (new) return point
  const y1 = await scrollCardTo(pg, 21, 300);
  await pg.click(`${card(21)} .fact-practise`); const r1 = await back();
  const y2 = await scrollCardTo(pg, 30, 500);
  await pg.click(`${card(30)} .fact-practise`); const r2 = await back();
  ok(Math.abs(r1.y - y1) <= 1 && Math.abs(r2.y - y2) <= 1 && y1 !== y2, `CUI-0010 e) consecutive sessions: ${r1.y}/${y1}, ${r2.y}/${y2} — no stale return point`);
  // f) ← Home mid-session then a new session elsewhere
  await nav(pg, `${card(30)} .fact-practise`);
  await nav(pg, '#screenQuiz .back-btn');
  await nav(pg, '#modeStudy');
  const y3 = await scrollCardTo(pg, 21, 200);
  await pg.click(`${card(21)} .fact-practise`); const r3 = await back();
  ok(r3.screen === 'screenStudy' && Math.abs(r3.y - y3) <= 1, `CUI-0010 f) ← Home mid-session, new session later returns to ${r3.y} (was ${y3})`);
  ok(errs.length === 0, 'CUI-0010 — no page / console errors ' + errs.join('|'));
  await ctx.close();
}


// ══════════ E9: a double tap on "▶ Practise" — the second tap lands on the quiz screen ══════════
async function doubleTapCase(b, w, touch) {
  const ctx = await b.newContext(touch ? { ...MOBILE, viewport: { width: w, height: 844 } } : { viewport: { width: w, height: 844 } });
  const pg = await ctx.newPage(); const errs = watchErrors(pg);
  await pg.goto(APP_URL); await pg.evaluate(() => localStorage.clear()); await pg.reload();
  await pg.evaluate(() => { openStudy(); studySetTab('chapters'); studySetChapter(3); });
  const res = [];
  for (const top of [120, 250, 400, 550, 700]) {
    await pg.evaluate(() => { localStorage.removeItem('lifeuk.practiceStreak'); localStorage.removeItem('lifeuk.wrongList'); streaks = {}; wrongList = {}; });
    await scrollCardTo(pg, 21, top);
    const p = await pg.locator(`${card(21)} .fact-practise`).boundingBox();
    const x = p.x + p.width / 2, y = p.y + p.height / 2;
    if (touch) { await pg.touchscreen.tap(x, y); await pg.waitForTimeout(120); await pg.touchscreen.tap(x, y); }
    else await pg.mouse.dblclick(x, y);
    await pg.waitForTimeout(100);
    const r = await pg.evaluate(() => ({ ex: state.examNum, answered: Object.keys(state.answers).length, revealed: JSON.stringify(state.revealed),
      streak: localStorage.getItem('lifeuk.practiceStreak'), wrong: Object.keys(JSON.parse(localStorage.getItem('lifeuk.wrongList') || '{}')).length }));
    res.push({ y: Math.round(y), ...r });
    await pg.evaluate(() => { leaveToHome(); openStudy(); });
  }
  await ctx.close();
  return { res, errs };
}
async function doubleTap(b) {
  for (const [w, touch] of [[390, true], [390, false], [900, false]]) {
    const { res, errs } = await doubleTapCase(b, w, touch);
    note(`E9 ${w} ${touch ? 'touch double tap' : 'mouse dblclick'}:`, JSON.stringify(res));
    const hit = res.filter(r => r.answered > 0);
    ok(hit.length === 0, `E9 ${w} ${touch ? 'touch' : 'mouse'}: a double activation of "▶ Practise" never answers Q1 (${hit.length}/${res.length} positions answered: ${hit.map(r => 'y' + r.y + ' streak ' + r.streak + ' wrong ' + r.wrong).join('; ')})`);
    ok(errs.length === 0, `E9 ${w}: no page errors ` + errs.join('|'));
  }
}

// ══════════ 5. CUI-0009 + S-030 tap targets ══════════
async function hitScan(pg) {
  return pg.evaluate(() => {
    const at = (x, y, el) => { const e = document.elementFromPoint(x, y); return !!e && (e === el || el.contains(e)); };
    const span = (el, axis) => { const r = el.getBoundingClientRect(); const mid = axis === 'v' ? r.left + r.width / 2 : r.top + r.height / 2; const out = [];
      const lo = axis === 'v' ? r.top : r.left, hi = axis === 'v' ? r.bottom : r.right;
      for (let d = Math.floor(lo) - 15; d <= Math.ceil(hi) + 15; d += 0.5) if (axis === 'v' ? at(mid, d, el) : at(d, mid, el)) out.push(d);
      return out.length ? { from: out[0] - lo, to: out[out.length - 1] - hi, size: out[out.length - 1] - out[0] + 0.5 } : null; };
    const e = document.querySelector('#studyContent .fact[data-fact-id="21"]'); const star = e.querySelector('.fact-btn.star'), tick = e.querySelector('.fact-btn.tick'), pr = e.querySelector('.fact-practise');
    const a = star.getBoundingClientRect(), c = tick.getBoundingClientRect(); const my = a.top + a.height / 2;
    // the gap between the two buttons: which button wins each half-pixel
    const gap = []; for (let x = a.right - 2; x <= c.left + 2; x += 0.5) gap.push([+(x - a.right).toFixed(1), at(x, my, star) ? 'S' : at(x, my, tick) ? 'T' : '-']);
    // every interactive element on screen (other than the Practise button) still hits itself at its centre and 2px inside each edge
    const stolen = [];
    for (const el of document.querySelectorAll('#screenStudy button, #screenStudy input')) {
      if (el === pr || !el.getClientRects().length) continue; const r = el.getBoundingClientRect(); if (r.bottom < 0 || r.top > innerHeight) continue;
      for (const [x, y] of [[r.left + r.width / 2, r.top + 2], [r.left + r.width / 2, r.bottom - 2], [r.left + 2, r.top + r.height / 2], [r.right - 2, r.top + r.height / 2]]) {
        const hit = document.elementFromPoint(x, y); if (hit && pr.contains(hit)) stolen.push(el.className);
      }
    }
    // what the Practise ring covers above / below
    const pb = pr.getBoundingClientRect(); const ring = getComputedStyle(pr, '::before');
    const above = document.elementsFromPoint(pb.left + 10, pb.top - 6).map(x => x.className).slice(0, 3);
    return { star: { w: a.width, h: a.height, v: span(star, 'v'), h2: span(star, 'h') }, tick: { v: span(tick, 'v'), h2: span(tick, 'h') }, gap,
      pr: { w: pb.width, h: pb.height, v: span(pr, 'v'), h2: span(pr, 'h'), ringBg: ring.backgroundColor, ringBorder: ring.borderTopStyle, ringContent: ring.content }, stolen, above };
  });
}
async function cardShot(b, ref, w, tag) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'lifeuk-qa063-ref-'));
  try {
    execSync(`git archive ${ref} | tar -x -C "${dir}"`, { cwd: ROOT, shell: '/bin/bash' });
    const ctx = await b.newContext({ viewport: { width: w, height: 844 } }); const pg = await ctx.newPage();
    await pg.goto('file://' + path.join(dir, 'index.html')); await pg.evaluate(() => localStorage.clear()); await pg.reload();
    await pg.evaluate(() => { openStudy(); studySetTab('chapters'); studySetChapter(3); const e = document.querySelector('#studyContent .fact[data-fact-id="21"]'); window.scrollTo(0, e.getBoundingClientRect().top + scrollY - 200); });
    await pg.waitForTimeout(150);
    const buf = await pg.locator('#studyContent .fact[data-fact-id="21"]').screenshot({ animations: 'disabled' });
    const box = await pg.locator('#studyContent .fact[data-fact-id="21"] .fact-practise').boundingBox().catch(() => null);
    fs.writeFileSync(shot(`tap-${tag}-${w}`), buf);
    await ctx.close();
    return { buf, box };
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
}
async function tapTargets(b) {
  for (const w of [390, 900]) {
    const { ctx, pg, errs } = await fresh(b, w);
    await pg.evaluate(() => { openStudy(); studySetTab('chapters'); studySetChapter(3); });
    await scrollCardTo(pg, 21, 300);
    const h = await hitScan(pg);
    note(`${w}: hit scan`, JSON.stringify({ star: h.star, tick: h.tick, pr: h.pr, above: h.above }));
    note(`${w}: gap ownership (x from bookmark right edge)`, h.gap.map(g => g.join(':')).join(' '));
    ok(h.star.w === 32 && h.star.h === 32, `${w}: fact buttons still 32×32`);
    ok(h.star.v.size >= 44 && h.tick.v.size >= 44, `${w}: CUI-0009 tappable height ≥ 44px (bookmark ${h.star.v.size}, ✓ ${h.tick.v.size})`);
    ok(h.star.h2.from <= -6 && h.tick.h2.to >= 6, `${w}: outer sides reach ≥ 6px past the visible edge (bookmark left ${h.star.h2.from}, ✓ right ${h.tick.h2.to})`);
    const insideOk = h.gap.filter(g => g[0] <= 0).every(g => g[1] === 'S') && h.gap.filter(g => g[0] >= 4).every(g => g[1] === 'T');
    ok(insideOk, `${w}: no cross-tap — every visible pixel of each button hits that button`);
    ok(h.pr.v.size >= 44 && h.pr.h2.from >= -1 && h.pr.h2.to <= 0.5, `${w}: S-030 Practise tappable height ≥ 44 (${h.pr.v.size}), width = visible (${h.pr.h2.from}…${h.pr.h2.to})`);
    ok(h.pr.ringBg === 'rgba(0, 0, 0, 0)' && h.pr.ringBorder === 'none', `${w}: Practise ring invisible (bg ${h.pr.ringBg}, border ${h.pr.ringBorder})`);
    ok(h.stolen.length === 0, `${w}: Practise ring takes no tap from any other button / input on screen (${h.stolen})`);
    // same check with the inline (≤ 3 nodes) layout
    await pg.evaluate(() => { const f = STUDY.find(x => x.ch === 3 && x.src.length <= 3); window.__inl = f.id; const e = document.querySelector(`#studyContent .fact[data-fact-id="${f.id}"]`); window.scrollTo(0, e.getBoundingClientRect().top + scrollY - 300); });
    const inl = await pg.evaluate(() => { const pr = document.querySelector(`#studyContent .fact[data-fact-id="${window.__inl}"] .fact-practise`); const r = pr.getBoundingClientRect();
      const hit = (x, y) => { const e = document.elementFromPoint(x, y); return e && pr.contains(e); };
      const yue = pr.closest('.fact').querySelector('.fact-yue').getBoundingClientRect(); const next = pr.closest('.fact').nextElementSibling; const nr = next && next.getBoundingClientRect();
      let v = []; for (let y = r.top - 15; y <= r.bottom + 15; y += 0.5) if (hit(r.left + r.width / 2, y)) v.push(y);
      return { id: window.__inl, size: v[v.length - 1] - v[0] + 0.5, top: v[0], bottom: v[v.length - 1], yueBottom: yue.bottom, cardBottom: pr.closest('.fact').getBoundingClientRect().bottom, nextTop: nr && nr.top }; });
    ok(inl.size >= 44 && inl.top > inl.yueBottom && inl.bottom < inl.cardBottom, `${w}: inline row (#${inl.id}) Practise ring ${inl.size}px stays inside the row (above the Cantonese text ${inl.yueBottom.toFixed(1)} < ${inl.top}, below card bottom ${inl.cardBottom.toFixed(1)})`);
    // wrapped row: how much of the nodes line the ring covers (nodes are display-only)
    const cover = await pg.evaluate(() => { const e = document.querySelector('#studyContent .fact[data-fact-id="21"]'); const pr = e.querySelector('.fact-practise');
      const nodes = [...e.querySelectorAll('.sqm-node')]; const lastRow = Math.max(...nodes.map(n => n.getBoundingClientRect().bottom));
      const ringTop = pr.getBoundingClientRect().top - (parseFloat(getComputedStyle(pr, '::before').top) * -1 || 0);
      let px = 0; const n = nodes[nodes.length - 1]; const r = n.getBoundingClientRect();
      for (let y = r.top; y < r.bottom; y += 0.5) { const h = document.elementFromPoint(r.left + r.width / 2, y); if (h && pr.contains(h)) px += 0.5; }
      return { nodeH: r.height, coveredPx: px, lastRow }; });
    note(`${w}: #21 wrapped row — Practise ring covers ${cover.coveredPx}px of the last node line (node ${cover.nodeH}px; nodes are display-only)`);
    // visual: unchanged by CUI-0009 / S-030 (pixel-identical card screenshots)
    const a = await cardShot(b, PRE_CUI0009, w, 'pre-cui0009'), c = await cardShot(b, CUI0009, w, 'cui0009');
    ok(a.buf.equals(c.buf), `${w}: CUI-0009 commit: card #21 pixel-identical to its parent`);
    const d = await cardShot(b, PRE_S030, w, 'pre-s030'), e = await cardShot(b, S030, w, 's030');
    ok(d.buf.equals(e.buf) && JSON.stringify(d.box) === JSON.stringify(e.box), `${w}: S-030 commit: card #21 pixel-identical, Practise box unchanged (${JSON.stringify(e.box)})`);
    ok(errs.length === 0, `${w}: tap targets — no page / console errors ` + errs.join('|'));
    await ctx.close();
  }
  // real touch taps (mobile emulation)
  const ctx = await b.newContext(MOBILE); const pg = await ctx.newPage(); const errs = watchErrors(pg);
  await pg.goto(APP_URL); await pg.evaluate(() => localStorage.clear()); await pg.reload();
  await pg.evaluate(() => { openStudy(); studySetTab('chapters'); studySetChapter(3); });
  await scrollCardTo(pg, 21, 300);
  const marks = () => pg.evaluate(() => [localStorage.getItem('lifeuk.studyBookmarks'), localStorage.getItem('lifeuk.studyMastered')]);
  const bx = k => pg.locator(`${card(21)} .fact-btn.${k}`).boundingBox();
  let s = await bx('star');
  await pg.touchscreen.tap(s.x + s.width / 2, s.y - 5.5);
  let m = await marks();
  ok(m[0] === '{"21":true}' && !m[1], `touch: tap 5.5px above bookmark toggles bookmark (${m})`);
  let t = await bx('tick');
  await pg.touchscreen.tap(t.x + t.width / 2, t.y + t.height + 5.5);
  m = await marks();
  ok(m[1] === '{"21":true}' && m[0] === '{"21":true}', `touch: tap 5.5px below ✓ toggles ✓ only (${m})`);
  s = await bx('star');
  await pg.touchscreen.tap(s.x + s.width - 0.5, s.y + s.height / 2);
  t = await bx('tick');
  await pg.touchscreen.tap(t.x + 0.5, t.y + t.height / 2);
  m = await marks();
  ok(m[0] === '{}' && m[1] === '{}', `touch: inner edges facing each other toggle their own button (${m})`);
  const p = await pg.locator(`${card(21)} .fact-practise`).boundingBox();
  await pg.touchscreen.tap(p.x + p.width / 2, p.y + p.height + 7);
  const ex = await pg.evaluate(() => state && state.examNum);
  ok(ex === 'f21', `touch: tap 7px below the Practise pill starts Fact #21 (${ex})`);
  ok(errs.length === 0, 'touch — no page errors ' + errs.join('|'));
  await ctx.close();
}

// ══════════ 6. Boot ══════════
function extract(ref, dir) { execSync(`git archive ${ref} | tar -x -C "${dir}"`, { cwd: ROOT, shell: '/bin/bash' }); }
const showRef = (ref, f) => execSync(`git show ${ref}:${f}`, { cwd: ROOT });
const FALLBACK = fs.readFileSync(path.join(ROOT, 'js/main.js'), 'utf8').match(/const I18N_BOOT_FALLBACK_MSG =\s*'([^']+)'/)[1];
async function bootCase(b, tag, prep, expect) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'lifeuk-qa063-boot-'));
  try {
    extract('HEAD', dir); prep(dir);
    const ctx = await b.newContext({ viewport: { width: 390, height: 844 } }); const pg = await ctx.newPage();
    const errs = []; pg.on('pageerror', e => errs.push(e.message));
    const cons = []; pg.on('console', m => cons.push(m.type() + ': ' + m.text()));
    let navs = 0; pg.on('framenavigated', f => { if (f === pg.mainFrame()) navs++; });
    await pg.goto('file://' + path.join(dir, 'index.html'));
    await pg.waitForTimeout(1200);
    const declared = [...errs, ...cons].filter(x => /already been declared/.test(x));
    if (expect === 'fallback') {
      const g = await pg.evaluate(() => byId('examGrid').textContent.trim());
      ok(navs === 2 && g === FALLBACK, `${tag}: one reload then fallback message (navs ${navs}, "${g.slice(0, 60)}")`);
    } else {
      const r = await pg.evaluate(() => ({ fc: typeof factCardHtml === 'function', side: typeof isSideSession === 'function', t: typeof t === 'function',
        links: document.querySelectorAll('link[rel="stylesheet"][href="css/components/fact.css"]').length, btns: document.querySelectorAll('#examGrid .exam-btn').length,
        scripts: document.querySelectorAll('script[src="js/components/factCard.js"]').length }));
      ok(navs === 1 && r.fc && r.side && r.t && r.btns > 0 && r.links === 1 && r.scripts === 1, `${tag}: boots, factCard.js + fact.css present once (${JSON.stringify(r)})`);
      await pg.evaluate(() => { openStudy(); studySetTab('chapters'); studySetChapter(3); });
      await pg.waitForTimeout(200);
      const st = await pg.evaluate(() => { const e = document.querySelector('#studyContent .fact[data-fact-id="21"]'); const c = getComputedStyle(e); const p = e.querySelector('.fact-practise');
        return { bl: c.borderLeftWidth, shadow: c.boxShadow, pad: c.paddingTop, radius: c.borderTopLeftRadius, src: !!e.querySelector('.fact-src'), pBorder: p && getComputedStyle(p).borderTopStyle,
          btnW: getComputedStyle(e.querySelector('.fact-btn')).width, progress: byId('studyProgress') ? byId('studyProgress').textContent : '(no element)' }; });
      ok(st.bl === '4px' && st.shadow !== 'none' && st.pad === '12px' && st.radius === '10px' && st.src && st.pBorder === 'solid' && st.btnW === '32px', `${tag}: Study card styled (${JSON.stringify(st)})`);
      const ses = await pg.evaluate(() => { startFactPractice(21); const l = byId('quizLabel').textContent; state.current = state.questions.length - 1; renderQuestion();
        const q = state.questions[state.current]; q.a.forEach(selectOption); byId('nextBtn').click(); return { l, screen: document.querySelector('.screen.active').id }; });
      ok(ses.l === factSetLabel(21) && ses.screen === 'screenStudy', `${tag}: fact session + ↩ Back work (${JSON.stringify(ses)})`);
      // S-039: a fixed key that always has Similar questions (fact #21 has 8 sources), not the first fact-linked
      // question of a shuffled exam (a one-source fact has no Similar panel → random null)
      const core = await pg.evaluate(() => { const k = STUDY.find(f => f.id === 21).src[0];
        leaveToHome(); pendingMode = PRACTICE_MODE; startExam(+k.split('.')[0]);
        const i = state.questions.findIndex(q => qKey(q) === k); if (i < 0) return 'key ' + k + ' not in session';
        state.current = i; renderQuestion(); state.questions[i].a.forEach(selectOption);
        const e = document.querySelector('#similarBox .sqm-fact'); return e ? getComputedStyle(e).borderLeftWidth + ' ' + getComputedStyle(e).backgroundColor + ' (' + k + ')' : null; });
      ok(core && core.startsWith('4px') && !/rgba\(0, 0, 0, 0\)/.test(core), `${tag}: Similar Core Fact styled (${core})`);
      await pg.screenshot({ path: shot(`boot-${tag.replace(/[^a-z0-9.]+/gi, '_')}`) });
    }
    ok(declared.length === 0, `${tag}: no "already been declared" ${declared.join('|')}`);
    ok(errs.length === 0, `${tag}: no page errors ${errs.join(' | ')}`);
    await ctx.close();
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
}
async function boot(b) {
  await bootCase(b, `v0.62 shell (${V062_REF}) + v0.63 js`, d => fs.writeFileSync(path.join(d, 'index.html'), showRef(V062_REF, 'index.html')), 'ok');
  await bootCase(b, `v0.57 shell (${V057_REF}) + v0.63 js`, d => fs.writeFileSync(path.join(d, 'index.html'), showRef(V057_REF, 'index.html')), 'ok');
  await bootCase(b, 'v0.63 shell, all files', () => {}, 'ok');
  await bootCase(b, 'v0.63 shell, factCard.js 404', d => fs.rmSync(path.join(d, 'js/components/factCard.js')), 'fallback');
  await bootCase(b, `v0.62 shell + factCard.js 404`, d => { fs.writeFileSync(path.join(d, 'index.html'), showRef(V062_REF, 'index.html')); fs.rmSync(path.join(d, 'js/components/factCard.js')); }, 'fallback');
}

// ══════════ mockup screenshots ══════════
async function mockupShots(b) {
  for (const w of [390, 900]) {
    const ctx = await b.newContext({ viewport: { width: w === 390 ? 1500 : 1000, height: 1400 } }); const pg = await ctx.newPage();
    for (const id of ['study-chapters', 'mastery', 'source-nodes', 'similar-core', 'fact-session', 'card-extras']) {
      await pg.goto('file://' + path.join(ROOT, 'mockups', 'study-unify.html') + '#' + id);
      await pg.click(`.mock-tab[data-w="${w}"]`);
      await pg.waitForTimeout(100);
      await pg.locator('.frames').first().screenshot({ path: shot(`mockup-${id}-${w}`) });
    }
    await ctx.close();
  }
}

(async () => {
  fs.mkdirSync(SHOT_DIR, { recursive: true });
  const b = await chromium.launch(launchOpts);
  const sections = { versionCheck, factCards, mastery, sourceRow, practiseFlow, cui0010, doubleTap, tapTargets, boot, mockupShots };
  const only = process.env.QA_ONLY ? process.env.QA_ONLY.split(',') : Object.keys(sections);
  try {
    for (const k of only) {
      console.log(`\n── ${k} ──`);
      try { await sections[k](b); } catch (e) { fail++; failures.push(`${k} threw ${e.message}`); console.log(`FAIL: ${k} threw`, e); }
    }
  } finally { await b.close(); }
  console.log(`\n${pass} passed, ${fail} failed`);
  if (failures.length) console.log('failures:\n - ' + failures.join('\n - '));
  process.exit(fail ? 1 : 0);
})();
