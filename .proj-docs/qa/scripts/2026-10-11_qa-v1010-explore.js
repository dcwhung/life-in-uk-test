// QA v1.0.10 exploratory (memo v2: .cont continuation lines, table-cell "• " remarks)
// Part 1: sampled memos x 3 screens (Practice answer box / Results review / Study 💡) x 2 viewports (390 / 320) x 2 UI langs
// Part 2: sweep — every question's note in the Practice answer box + every exam's Results review + every Study memo at 320 / 390
// Part 3: S-165 — width of "• " and the wrapped-line offset of a cell bullet remark per font
// Part 4: edge cases (renderer)
// run: NODE_PATH=<dir with playwright-core> CHROMIUM_PATH=/opt/pw-browsers/chromium node <this>; screenshots -> $QA_OUT
const { chromium } = require('playwright-core');
const fs = require('fs');
const path = require('path');
const ROOT = process.env.QA_ROOT || path.resolve(__dirname, '..', '..', '..');
const URL = 'file://' + ROOT + '/index.html';
const OUT = process.env.QA_OUT || '/tmp/qa-v1010';
fs.mkdirSync(OUT, { recursive: true });
const PICK = { '5B': '1.5', N20a: '8.14', N16b: '5.17', '4A': '6.8', 'N8a-1': '8.15', 'N8a-2': '14.23', 'N8a-3': '16.18', N8b: '2.11' };
const VPS = (process.env.QA_VPS || '390,320').split(',').map(Number);
const LANGS = ['en', 'zh-HK'];
const TOL = 1;
let pass = 0, fail = 0; const bad = [];
const ok = (c, m) => { if (c) pass++; else { fail++; bad.push(m); } };

// inspect one rendered note host: cont / sub alignment, cell bullet indent + hanging indent, table / page scroll
const INSPECT = `(root) => {
  const rects = (n, s, e) => { const r = document.createRange(); if (s == null) r.selectNodeContents(n); else { r.setStart(n, s); r.setEnd(n, e); } return [...r.getClientRects()].filter(x => x.width > 0); };
  const textNode = el => [...el.childNodes].reverse().find(n => n.nodeType === 3);
  const lines = [...root.querySelectorAll('.rv-note-line')];
  const cont = lines.filter(l => l.classList.contains('cont')).map(c => {
    let i = lines.indexOf(c) - 1; while (i >= 0 && !lines[i].classList.contains('sub')) i--;
    const tn = textNode(c), rs = rects(tn), sub = lines[i];
    return { text: c.textContent, x: rs[0].left, lastX: rs[rs.length - 1].left, n: new Set(rs.map(r => Math.round(r.top))).size,
      subX: sub ? rects(textNode(sub))[0].left : null, subText: sub && sub.textContent };
  });
  const cells = [...root.querySelectorAll('.note-cell-sub.bullet')].map(s => {
    const td = s.parentElement, tn = s.firstChild, em = parseFloat(getComputedStyle(s).fontSize);
    const plainLeft = rects(td.firstChild)[0].left; // the cell's main text
    const dot = rects(tn, 0, 1)[0].left, after = rects(tn, 2, 3)[0].left, all = rects(tn);
    const lineLefts = [...new Map(all.map(r => [Math.round(r.top), r.left])).values()];
    return { text: s.textContent, em, indentEm: (dot - plainLeft) / em, markEm: (after - dot) / em, wrapped: lineLefts.length > 1,
      wrapDelta: lineLefts.length > 1 ? lineLefts[lineLefts.length - 1] - after : 0 };
  });
  const wraps = [...root.querySelectorAll('.note-table-wrap')].map(w => [w.scrollWidth, w.clientWidth]);
  const langs = [...root.querySelectorAll('.rv-note-line, .note-table')].map(e => e.closest('[lang]').getAttribute('lang'));
  return { cont, cells, wraps, page: [document.documentElement.scrollWidth, innerWidth], nLines: lines.length,
    nTables: wraps.length, langOk: langs.every(l => l === 'zh-HK'), visible: root.getBoundingClientRect().height > 0 };
}`;

function judge(where, r) {
  ok(r.visible, `${where}: note visible`);
  ok(r.langOk, `${where}: lines / tables carry lang=zh-HK`);
  ok(r.page[0] <= r.page[1], `${where}: no page h-scroll ${r.page}`);
  ok(r.wraps.every(([s, c]) => s <= c), `${where}: table fits, no h-scroll ${JSON.stringify(r.wraps)}`);
  for (const c of r.cont) ok(c.subX != null && Math.abs(c.x - c.subX) <= TOL && Math.abs(c.lastX - c.subX) <= TOL,
    `${where}: cont "${c.text}" x=${c.x.toFixed(1)} / last ${c.lastX.toFixed(1)} vs text after → ${c.subX && c.subX.toFixed(1)}`);
  for (const c of r.cells) ok(c.indentEm >= 0.8 && c.indentEm <= 1.0 && Math.abs(c.wrapDelta) <= TOL,
    `${where}: cell bullet "${c.text.slice(0, 20)}" indent ${c.indentEm.toFixed(2)}em, wrap delta ${c.wrapDelta.toFixed(1)}px`);
}

async function openPractice(pg, key, src) {
  return pg.evaluate(({ key, src }) => {
    const [e, i] = key.split('.').map(Number);
    pendingMode = 'practice'; startExam(e);
    state.current = state.questions.findIndex(q => q.examNum === e && q.origIdx === i);
    renderQuestion(); state.questions[state.current].a.forEach(selectOption);
    const box = document.getElementById('ansNote'); box.scrollIntoView();
    return new Function('return ' + src)()(box);
  }, { key, src });
}
async function openResults(pg, key, src) {
  return pg.evaluate(({ key, src }) => {
    const [e, i] = key.split('.').map(Number);
    pendingMode = 'exam'; startExam(e); state.questions.forEach((q, j) => { state.answers[j] = [...q.a]; }); finishExam();
    const idx = state.questions.findIndex(q => q.examNum === e && q.origIdx === i);
    const it = document.getElementById('rv' + idx) || [...document.querySelectorAll('#reviewList .review-item')].find(x => Number(x.id.slice(2)) === idx);
    if (!it) return { missing: true };
    it.scrollIntoView();
    return { id: it.id, ...new Function('return ' + src)()(it) };
  }, { key, src });
}
async function openStudy(pg, key, src) {
  return pg.evaluate(({ key, src }) => {
    openStudy();
    const f = STUDY.find(f => f.src.includes(key) && factMemoryText(f)) || STUDY.find(f => f.src.includes(key));
    if (!f) return { missing: 'no fact for ' + key };
    if (!factMemoryText(f)) return { missing: 'fact ' + f.id + ' has no memo' };
    studySetTab('chapters'); studySetChapter(f.ch);
    const card = document.querySelector(`#studyContent .fact[data-fact-id="${f.id}"]`);
    if (!card) return { missing: 'card ' + f.id };
    const d = card.querySelector('details.fact-mem'); d.open = true; card.scrollIntoView();
    return { factId: f.id, label: d.querySelector('summary').textContent, ...new Function('return ' + src)()(d.querySelector('.fact-mem-body')) };
  }, { key, src });
}

(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH, args: ['--no-sandbox'] });
  const errs = [];
  const sample = [];
  // ── Part 1: samples
  if (!process.env.QA_SWEEP_ONLY) for (const lang of LANGS) for (const vw of VPS) { // QA_SWEEP_ONLY=1: baseline run on another checkout
    const pg = await b.newPage({ viewport: { width: vw, height: 900 } });
    pg.on('pageerror', e => errs.push(e.message)); pg.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
    await pg.goto(URL); await pg.evaluate(() => localStorage.clear()); await pg.reload();
    await pg.evaluate(l => setLang(l), lang);
    for (const [g, key] of Object.entries(PICK)) {
      const tag = `${lang} ${vw} ${g} ${key}`;
      const p = await openPractice(pg, key, INSPECT); judge(`${tag} practice`, p); sample.push({ tag, screen: 'practice', ...p });
      await pg.locator('#ansNote').screenshot({ path: `${OUT}/practice-${g}-${vw}-${lang}.png` });
      const r = await openResults(pg, key, INSPECT);
      ok(!r.missing, `${tag} results: review item found`);
      if (!r.missing) { judge(`${tag} results`, r); sample.push({ tag, screen: 'results', ...r }); await pg.locator('#' + r.id).screenshot({ path: `${OUT}/results-${g}-${vw}-${lang}.png` }); }
      const s = await openStudy(pg, key, INSPECT);
      ok(!s.missing, `${tag} study: ${s.missing || 'memo card found'}`);
      if (!s.missing) {
        judge(`${tag} study`, s); sample.push({ tag, screen: 'study', ...s });
        ok(lang !== 'zh-HK' || /記憶法/.test(s.label), `${tag} study summary label localised: ${s.label}`);
        await pg.locator(`#studyContent .fact[data-fact-id="${s.factId}"]`).screenshot({ path: `${OUT}/study-${g}-${vw}-${lang}.png` });
      }
    }
    await pg.close();
  }
  // ── Part 2: sweep (en UI; lang does not change the note markup)
  const sweep = {};
  for (const vw of VPS) {
    const pg = await b.newPage({ viewport: { width: vw, height: 900 } });
    pg.on('pageerror', e => errs.push(e.message));
    await pg.goto(URL); await pg.evaluate(() => localStorage.clear()); await pg.reload();
    const res = await pg.evaluate(src => {
      const ins = new Function('return ' + src)();
      const out = { practice: [], results: [], study: [] };
      for (const e of Object.keys(EXAMS).map(Number)) {
        pendingMode = 'practice'; startExam(e);
        for (let j = 0; j < state.questions.length; j++) {
          if (!state.questions[j].note) continue;
          state.current = j; renderQuestion(); state.questions[j].a.forEach(selectOption);
          const box = document.getElementById('ansNote');
          out.practice.push({ key: e + '.' + state.questions[j].origIdx, ...ins(box) });
        }
        pendingMode = 'exam'; startExam(e); state.questions.forEach((q, j) => { state.answers[j] = [...q.a]; }); finishExam();
        for (const it of document.querySelectorAll('#reviewList .review-item')) if (it.querySelector('.rv-note-line, .note-table'))
          out.results.push({ key: e + '#' + it.id, ...ins(it) });
      }
      openStudy(); studySetTab('chapters');
      for (const ch of [...new Set(STUDY.map(f => f.ch))]) {
        studySetChapter(ch);
        for (const d of document.querySelectorAll('#studyContent details.fact-mem')) { d.open = true; out.study.push({ key: 'ch' + ch + ':' + d.closest('.fact').dataset.factId, ...ins(d.querySelector('.fact-mem-body')) }); }
      }
      return out;
    }, INSPECT);
    for (const [screen, list] of Object.entries(res)) {
      let conts = 0, cells = 0, maxCont = 0, maxWrap = 0, maxIndentDev = 0, tables = 0;
      for (const r of list) {
        judge(`sweep ${vw} ${screen} ${r.key}`, { ...r, visible: true });
        conts += r.cont.length; cells += r.cells.length; tables += r.nTables;
        r.cont.forEach(c => { maxCont = Math.max(maxCont, Math.abs(c.x - c.subX), Math.abs(c.lastX - c.subX)); });
        r.cells.forEach(c => { maxWrap = Math.max(maxWrap, Math.abs(c.wrapDelta)); maxIndentDev = Math.max(maxIndentDev, Math.abs(c.indentEm - 0.9)); });
      }
      sweep[`${vw} ${screen}`] = { notes: list.length, tables, conts, cells, wrappedCells: list.reduce((a, r) => a + r.cells.filter(c => c.wrapped).length, 0),
        maxContDeltaPx: +maxCont.toFixed(2), maxCellWrapDeltaPx: +maxWrap.toFixed(2), maxIndentDevEm: +maxIndentDev.toFixed(3) };
    }
    await pg.close();
  }
  if (process.env.QA_SWEEP_ONLY) {
    console.log('sweep', JSON.stringify(sweep)); bad.forEach(x => console.log('  BAD', x));
    console.log(`SWEEP ${fail ? 'FAIL' : 'PASS'} ${pass}/${pass + fail}`); await b.close(); return;
  }
  // ── Part 3: S-165 per font
  const fonts = {};
  {
    const pg = await b.newPage({ viewport: { width: 390, height: 900 } });
    await pg.goto(URL);
    for (const font of ['(app default stack)', 'Inter', 'DejaVu Sans', 'WenQuanYi Zen Hei', 'Unifont']) {
      fonts[font] = await pg.evaluate(font => {
        const host = document.createElement('div'); host.style.width = '200px';
        if (!font.startsWith('(')) host.style.fontFamily = `'${font}'`;
        document.body.appendChild(host);
        host.innerHTML = noteHtml('| # | 名稱 |\n| 1 | Council：<br>歐洲委員會<br>• ' + '保障歐洲人嘅基本權利同自由'.repeat(3) + ' |');
        const s = host.querySelector('.note-cell-sub.bullet'), tn = s.firstChild, em = parseFloat(getComputedStyle(s).fontSize);
        const rg = (a, z) => { const r = document.createRange(); r.setStart(tn, a); r.setEnd(tn, z); return [...r.getClientRects()].filter(x => x.width > 0); };
        const after = rg(2, 3)[0].left, all = rg(0, tn.length);
        const lefts = [...new Map(all.map(r => [Math.round(r.top), r.left])).values()];
        const markW = after - rg(0, 1)[0].left;
        host.remove();
        return { em, markEm: +(markW / em).toFixed(3), wrapDeltaPx: +(lefts[lefts.length - 1] - after).toFixed(2), lines: lefts.length };
      }, font);
    }
    await pg.close();
  }
  // ── Part 4: edge cases
  const edge = {};
  {
    const pg = await b.newPage({ viewport: { width: 320, height: 900 } });
    pg.on('pageerror', e => errs.push(e.message));
    await pg.goto(URL); await pg.evaluate(() => localStorage.clear()); await pg.reload();
    Object.assign(edge, await pg.evaluate(() => {
      const cls = l => { const d = document.createElement('div'); d.innerHTML = noteHtml(l); return d.firstChild.className; };
      const host = document.createElement('div'); host.style.width = '288px'; document.body.appendChild(host);
      // E1 whitespace-only 8+ space line = gap, not an empty cont row
      const e1 = cls('          ');
      // E2 tab / U+3000 indents also count as cont (regex \s) — data has none
      const e2 = [cls('\t\t\t\t\t\t\t\tx'), cls('　'.repeat(8) + 'x'), cls('        ※ remark')];
      // E3 orphan cont right under a "•" bullet (no "→" above): text lands one indent right of the bullet text
      host.innerHTML = noteHtml('• Henry VII\n        York vs Lancaster');
      const [bl, ct] = host.querySelectorAll('.rv-note-line');
      const left = n => { const r = document.createRange(); r.selectNodeContents(n); return r.getClientRects()[0].left; };
      const e3 = { bulletText: left(bl.lastChild), cont: left(ct.lastChild) };
      // E4 cell remarks: nbsp after "•" is a bullet; "• " in the main part is not; empty "• " remark
      const d = document.createElement('div');
      d.innerHTML = noteHtml('| a |\n| • main<br>• nbsp<br>• <br>x |');
      const e4 = [...d.querySelectorAll('.note-cell-sub')].map(s => s.className + '=' + JSON.stringify(s.textContent));
      // E5 long unbreakable English in a cont line at 320px
      host.innerHTML = noteHtml('• a\n    → b\n        ' + 'Supercalifragilisticexpialidocious'.repeat(3));
      const e5 = { scroll: host.scrollWidth, width: host.clientWidth, doc: document.documentElement.scrollWidth, vw: innerWidth };
      // E6 injection in a cell bullet / cont
      host.innerHTML = noteHtml('| a |\n| x<br>• <img src=x onerror=window.__xss=1> |\n• a\n    → b\n        <script>window.__xss=2</script>');
      const e6 = { imgs: host.querySelectorAll('img, script').length, xss: window.__xss || 0 };
      host.remove();
      return { e1, e2, e3, e4, e5, e6 };
    }));
    // E7 idempotency: re-render the 5B answer box, switch UI language with it open, same note DOM
    edge.e7 = await pg.evaluate(() => {
      pendingMode = 'practice'; startExam(1); state.current = state.questions.findIndex(q => q.origIdx === 5);
      renderQuestion(); state.questions[state.current].a.forEach(selectOption);
      const a = document.getElementById('ansNote').querySelector('.rv-note, .ans-note-text, div').parentElement.innerHTML;
      setLang('zh-HK'); renderQuestion(); state.questions[state.current].a.forEach(selectOption);
      const box = document.getElementById('ansNote');
      const conts = box.querySelectorAll('.rv-note-line.cont').length;
      setLang('en');
      return { conts, sameNoteMarkup: box.querySelectorAll('.rv-note-line').length === new DOMParser().parseFromString(a, 'text/html').querySelectorAll('.rv-note-line').length };
    });
    await pg.close();
  }
  ok(edge.e1 === 'rv-note-gap', 'E1 whitespace-only 8-space line renders as a gap: ' + edge.e1);
  ok(edge.e3.cont > edge.e3.bulletText, `E3 orphan cont under a bullet is indented past the bullet text (${edge.e3.cont} vs ${edge.e3.bulletText}) — documented, data has none`);
  ok(edge.e4[0].endsWith('bullet="• nbsp"') && !edge.e4[0].includes('main'), 'E4 nbsp "•" remark → bullet; main-part "• " stays main text: ' + edge.e4);
  // E5 is an observation, not a v1.0.10 gate: .rv-note-line has no overflow-wrap (any line type, since v0.70); data has no such word
  console.log('E5 (info) long unbreakable word in a cont line overflows its host:', JSON.stringify(edge.e5));
  ok(edge.e6.imgs === 0 && edge.e6.xss === 0, 'E6 markup in cell bullet / cont line is escaped');
  ok(edge.e7.conts === 3 && edge.e7.sameNoteMarkup, 'E7 re-render + UI language switch keeps the 3 cont lines ' + JSON.stringify(edge.e7));
  ok(errs.length === 0, 'no page / console errors: ' + errs.join('; '));
  fs.writeFileSync(OUT + '/explore.json', JSON.stringify({ sample, sweep, fonts, edge, errs }, null, 1));
  console.log('sweep', JSON.stringify(sweep, null, 1));
  console.log('fonts', JSON.stringify(fonts, null, 1));
  console.log('edge', JSON.stringify(edge));
  for (const s of sample.filter(s => s.tag.startsWith('zh-HK 320'))) console.log(s.tag, s.screen, 'cont', s.cont.length, 'cells', s.cells.length, 'wraps', JSON.stringify(s.wraps));
  bad.forEach(x => console.log('  BAD', x));
  console.log(`EXPLORE ${fail ? 'FAIL' : 'PASS'} ${pass}/${pass + fail}`);
  await b.close();
})().catch(e => { console.error(e); process.exit(1); });
