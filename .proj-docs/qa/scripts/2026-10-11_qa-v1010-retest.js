// QA v1.0.10 re-test (S-165 .note-mark in cell bullets, CUI-0027 / W-050 < 360px cell padding)
// Part 1: sweep — every note host in Practice answer box / Results review / Study 💡 at $QA_VPS (default 320,340,360,390)
//         x en / zh-HK: table overflow (.note-table-wrap scrollWidth > clientWidth), cells without "<br>" that wrap
//         (Range client rects on > 1 line), cell bullet indent + wrapped-line offset, cont alignment, page h-scroll
// Part 2: S-165 — "• " remark wrapped-line offset per font (Inter / DejaVu Sans / WenQuanYi Zen Hei / Unifont)
// Part 3: S-171 — 320px Study cards of 10B / ⑤ / ⑤N (+ N13a / N19a / 10A): natural table width vs host, per font stack
//         (Chromium fallback fonts only; real devices not verified)
// Part 4: edge cases for the new markup
// env: QA_ROOT (checkout to test, default this repo), QA_VPS, QA_PARTS (e.g. "1" for a baseline sweep on an old checkout)
// run: NODE_PATH=<dir with playwright-core> CHROMIUM_PATH=/opt/pw-browsers/chromium node <this>
const { chromium } = require('playwright-core');
const fs = require('fs');
const path = require('path');
const REPO = path.resolve(__dirname, '..', '..', '..');
const ROOT = process.env.QA_ROOT || REPO;
const URL = 'file://' + ROOT + '/index.html';
const VPS = (process.env.QA_VPS || '320,340,360,390').split(',').map(Number);
const PARTS = (process.env.QA_PARTS || '1234').split('');
const LANGS = ['en', 'zh-HK'];
const TOL = 1;
let pass = 0, fail = 0; const bad = [];
const ok = (c, m) => { if (c) pass++; else { fail++; bad.push(m); } };

// memo id per table: header row + first body cell (fixture, from the repo under test)
const SPEC = JSON.parse(fs.readFileSync(path.join(REPO, 'tests', 'fixtures', 'memo-notes.json'), 'utf8'));
const TABLE_IDS = {};
for (const m of SPEC.memos) {
  const rows = m.text.split('\n').filter(l => l.trim().startsWith('|')).map(l => l.trim().replace(/^\||\|$/g, '').split('|').map(c => c.trim().split('<br>')[0]));
  if (rows.length < 2) continue;
  const k = rows[0].join('|') + '#' + rows[1][0];
  TABLE_IDS[k] = TABLE_IDS[k] ? TABLE_IDS[k] + '/' + m.id : m.id;
}

// works with both markups: 7bfc331 ("• " text inside the span) and HEAD (<span class="note-mark">• </span>text)
const INSPECT = `(root, ids) => {
  const rects = (n, s, e) => { const r = document.createRange(); if (s == null) r.selectNodeContents(n); else { r.setStart(n, s); r.setEnd(n, e); } return [...r.getClientRects()].filter(x => x.width > 0); };
  const textNode = el => [...el.childNodes].reverse().find(n => n.nodeType === 3);
  const lineLefts = rs => [...new Map(rs.map(r => [Math.round(r.top), r.left])).values()];
  const lines = [...root.querySelectorAll('.rv-note-line')];
  const cont = lines.filter(l => l.classList.contains('cont')).map(c => {
    let i = lines.indexOf(c) - 1; while (i >= 0 && !lines[i].classList.contains('sub')) i--;
    const rs = rects(textNode(c)), sub = lines[i];
    return { x: rs[0].left, lastX: rs[rs.length - 1].left, subX: sub ? rects(textNode(sub))[0].left : null };
  });
  const cells = [...root.querySelectorAll('.note-cell-sub.bullet')].map(s => {
    const td = s.parentElement, em = parseFloat(getComputedStyle(s).fontSize), mark = s.querySelector('.note-mark');
    const plainLeft = rects(td.firstChild)[0].left;
    let dot, text;
    if (mark) { dot = rects(mark.firstChild, 0, 1)[0].left; const tn = mark.nextSibling; text = rects(tn); }
    else { const tn = s.firstChild; dot = rects(tn, 0, 1)[0].left; text = rects(tn, 2, tn.length); }
    const ll = lineLefts(text);
    return { mark: !!mark, indentEm: (dot - plainLeft) / em, textEm: (ll[0] - dot) / em, wrapped: ll.length > 1, wrapDelta: ll.length > 1 ? ll[ll.length - 1] - ll[0] : 0 };
  });
  const tables = [...root.querySelectorAll('.note-table-wrap')].map(w => {
    const t = w.querySelector('table'), head = [...t.querySelectorAll('thead th')].map(x => x.textContent.trim()).join('|');
    const first = t.querySelector('tbody tr td'), firstMain = first ? (first.firstChild.textContent || '').trim() : '';
    const keep = t.style.width; t.style.width = 'min-content'; const natural = t.getBoundingClientRect().width; t.style.width = keep;
    const broken = [...t.querySelectorAll('th:not(.multi), td:not(.multi)')].filter(c => c.textContent.trim() && new Set(rects(c).map(r => Math.round(r.top))).size > 1).map(c => c.textContent.trim());
    return { id: ids[head + '#' + firstMain] || '?', sw: w.scrollWidth, cw: w.clientWidth, natural: +natural.toFixed(2), room: +(w.clientWidth - natural).toFixed(2), broken };
  });
  const langs = [...root.querySelectorAll('.rv-note-line, .note-table')].map(e => e.closest('[lang]').getAttribute('lang'));
  return { cont, cells, tables, page: [document.documentElement.scrollWidth, innerWidth], langOk: langs.every(l => l === 'zh-HK') };
}`;

// every note host on the 3 screens (same walk as the v1.0.10 explore sweep)
const SWEEP = `({ src, ids }) => {
  const ins = new Function('return ' + src)();
  const out = { practice: [], results: [], study: [] };
  for (const e of Object.keys(EXAMS).map(Number)) {
    pendingMode = 'practice'; startExam(e);
    for (let j = 0; j < state.questions.length; j++) {
      if (!state.questions[j].note) continue;
      state.current = j; renderQuestion(); state.questions[j].a.forEach(selectOption);
      out.practice.push({ key: e + '.' + state.questions[j].origIdx, ...ins(document.getElementById('ansNote'), ids) });
    }
    pendingMode = 'exam'; startExam(e); state.questions.forEach((q, j) => { state.answers[j] = [...q.a]; }); finishExam();
    for (const it of document.querySelectorAll('#reviewList .review-item')) if (it.querySelector('.rv-note-line, .note-table'))
      out.results.push({ key: e + '#' + it.id, ...ins(it, ids) });
  }
  openStudy(); studySetTab('chapters');
  for (const ch of [...new Set(STUDY.map(f => f.ch))]) {
    studySetChapter(ch);
    for (const d of document.querySelectorAll('#studyContent details.fact-mem')) { d.open = true; out.study.push({ key: 'ch' + ch + ':' + d.closest('.fact').dataset.factId, ...ins(d.querySelector('.fact-mem-body'), ids) }); }
  }
  return out;
}`;

async function newPage(b, vw, errs, font) {
  const pg = await b.newPage({ viewport: { width: vw, height: 900 } });
  pg.on('pageerror', e => errs.push(e.message)); pg.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  await pg.goto(URL); await pg.evaluate(() => localStorage.clear()); await pg.reload();
  if (font) await pg.addStyleTag({ content: `body { font-family: ${font} !important; }` });
  return pg;
}

(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH, args: ['--no-sandbox'] });
  const errs = [], result = { root: ROOT };
  // ── Part 1: sweep
  if (PARTS.includes('1')) {
    result.sweep = {}; result.overflow = {};
    for (const lang of LANGS) for (const vw of VPS) {
      const pg = await newPage(b, vw, errs);
      await pg.evaluate(l => setLang(l), lang);
      const res = await pg.evaluate(new Function('return ' + SWEEP)(), { src: INSPECT, ids: TABLE_IDS }).catch(e => { throw e; });
      for (const [screen, list] of Object.entries(res)) {
        const tag = `${lang} ${vw} ${screen}`;
        let maxCont = 0, maxWrap = 0, maxIndentDev = 0, maxTextDev = 0, minRoom = Infinity;
        const over = [], broken = [];
        for (const r of list) {
          ok(r.langOk, `${tag} ${r.key}: lang=zh-HK`);
          ok(r.page[0] <= r.page[1], `${tag} ${r.key}: page h-scroll ${r.page}`);
          r.cont.forEach(c => { maxCont = Math.max(maxCont, Math.abs(c.x - c.subX), Math.abs(c.lastX - c.subX)); });
          r.cells.forEach(c => { maxWrap = Math.max(maxWrap, Math.abs(c.wrapDelta)); maxIndentDev = Math.max(maxIndentDev, Math.abs(c.indentEm - 0.9)); maxTextDev = Math.max(maxTextDev, Math.abs(c.textEm - 0.9)); });
          r.tables.forEach(t => {
            minRoom = Math.min(minRoom, t.room);
            if (t.sw > t.cw) over.push(`${r.key} ${t.id} +${t.sw - t.cw}`);
            t.broken.forEach(x => broken.push(`${r.key} ${t.id} "${x}"`));
          });
        }
        ok(maxCont <= TOL, `${tag}: cont max delta ${maxCont}`);
        ok(maxWrap <= TOL, `${tag}: cell bullet wrap max delta ${maxWrap}`);
        result.sweep[tag] = { hosts: list.length, tables: list.reduce((a, r) => a + r.tables.length, 0), cells: list.reduce((a, r) => a + r.cells.length, 0),
          markSpans: list.reduce((a, r) => a + r.cells.filter(c => c.mark).length, 0), wrappedCells: list.reduce((a, r) => a + r.cells.filter(c => c.wrapped).length, 0),
          overflow: over.length, brokenNoBr: broken.length, minRoomPx: +minRoom.toFixed(2), maxContPx: +maxCont.toFixed(2), maxCellWrapPx: +maxWrap.toFixed(2),
          maxIndentDevEm: +maxIndentDev.toFixed(3), maxTextDevEm: +maxTextDev.toFixed(3) };
        result.overflow[tag] = { over, broken: broken.slice(0, 30) };
      }
      await pg.close();
    }
  }
  // ── Part 2: S-165 per font (same probe as the v1.0.10 explore Part 3, now reading the .note-mark markup)
  if (PARTS.includes('2')) {
    result.fonts = {};
    const pg = await newPage(b, 390, errs);
    for (const font of ['(app default stack)', 'Inter', 'DejaVu Sans', 'WenQuanYi Zen Hei', 'Unifont']) {
      result.fonts[font] = await pg.evaluate(font => {
        const out = {};
        for (const w of [200, 140]) {
          const host = document.createElement('div'); host.style.width = w + 'px';
          if (!font.startsWith('(')) host.style.fontFamily = `'${font}'`;
          document.body.appendChild(host);
          host.innerHTML = noteHtml('| # | 名稱 |\n| 1 | Council：<br>歐洲委員會<br>• ' + '保障歐洲人嘅基本權利同自由'.repeat(3) + '<br>• Protects human rights and freedoms of people across Europe |');
          out[w] = [...host.querySelectorAll('.note-cell-sub.bullet')].map(s => {
            const mark = s.querySelector('.note-mark'), tn = mark.nextSibling, em = parseFloat(getComputedStyle(s).fontSize);
            const rg = n => { const r = document.createRange(); r.selectNodeContents(n); return [...r.getClientRects()].filter(x => x.width > 0); };
            const glyph = (() => { const r = document.createRange(); r.setStart(mark.firstChild, 0); r.setEnd(mark.firstChild, 2); return r.getBoundingClientRect().width; })();
            const lefts = [...new Map(rg(tn).map(r => [Math.round(r.top), r.left])).values()];
            const dot = (() => { const r = document.createRange(); r.setStart(mark.firstChild, 0); r.setEnd(mark.firstChild, 1); return r.getBoundingClientRect().left; })();
            const cellText = s.parentElement.firstChild; const r0 = document.createRange(); r0.selectNodeContents(cellText);
            return { em, glyphEm: +(glyph / em).toFixed(3), markBoxEm: +(mark.getBoundingClientRect().width / em).toFixed(3),
              dotIndentEm: +((dot - r0.getClientRects()[0].left) / em).toFixed(3), textEm: +((lefts[0] - dot) / em).toFixed(3),
              lines: lefts.length, wrapDeltaPx: +(lefts[lefts.length - 1] - lefts[0]).toFixed(2) };
          });
          host.remove();
        }
        return out;
      }, font);
    }
    await pg.close();
  }
  // ── Part 3: S-171 per font stack, 320px Study cards
  if (PARTS.includes('3')) {
    result.s171 = {};
    const STACKS = {
      'app default (resolves to Inter here)': null,
      'Inter + WenQuanYi Zen Hei': `'Inter', 'WenQuanYi Zen Hei', sans-serif`,
      'DejaVu Sans + WenQuanYi Zen Hei': `'DejaVu Sans', 'WenQuanYi Zen Hei', sans-serif`,
      'Liberation Sans + IPAPGothic': `'Liberation Sans', 'IPAPGothic', sans-serif`,
      'FreeSans + IPAGothic': `'FreeSans', 'IPAGothic', sans-serif`,
      'WenQuanYi Zen Hei (CJK font for Latin too)': `'WenQuanYi Zen Hei', sans-serif`,
      'IPAPGothic (CJK font for Latin too)': `'IPAPGothic', sans-serif`,
      'Unifont': `'Unifont', sans-serif`,
    };
    const WATCH = /^(10B|10A|⑤\/⑤N|⑤|⑤N|N13a|N19a)$/;
    for (const [name, stack] of Object.entries(STACKS)) {
      const pg = await newPage(b, 320, errs, stack);
      const res = await pg.evaluate(({ src, ids }) => {
        const ins = new Function('return ' + src)();
        const out = { study: [], practice: [] };
        openStudy(); studySetTab('chapters');
        for (const ch of [...new Set(STUDY.map(f => f.ch))]) {
          studySetChapter(ch);
          for (const d of document.querySelectorAll('#studyContent details.fact-mem')) { d.open = true; ins(d.querySelector('.fact-mem-body'), ids).tables.forEach(t => out.study.push({ fact: d.closest('.fact').dataset.factId, ...t })); }
        }
        for (const key of ['14.18', '1.20']) { // 10B, ⑤ in the Practice answer box
          const [e, i] = key.split('.').map(Number);
          pendingMode = 'practice'; startExam(e); state.current = state.questions.findIndex(q => q.examNum === e && q.origIdx === i);
          renderQuestion(); state.questions[state.current].a.forEach(selectOption);
          ins(document.getElementById('ansNote'), ids).tables.forEach(t => out.practice.push({ key, ...t }));
        }
        return out;
      }, { src: INSPECT, ids: TABLE_IDS });
      const all = res.study;
      const per = {};
      for (const t of all.filter(t => WATCH.test(t.id))) {
        const p = per[t.id] || (per[t.id] = { cards: 0, cw: t.cw, minRoom: Infinity, overflow: 0, broken: 0 });
        p.cards++; p.minRoom = Math.min(p.minRoom, t.room); if (t.sw > t.cw) p.overflow++; p.broken += t.broken.length;
      }
      result.s171[name] = { studyTables: all.length, studyOverflow: all.filter(t => t.sw > t.cw).length, studyBroken: all.reduce((a, t) => a + t.broken.length, 0),
        minRoomAll: +Math.min(...all.map(t => t.room)).toFixed(2), worst: all.slice().sort((x, y) => x.room - y.room).slice(0, 3).map(t => `${t.id} #${t.fact} ${t.room.toFixed(1)}px`),
        watch: per, practice: res.practice.map(t => `${t.key} ${t.id} cw ${t.cw} room ${t.room.toFixed(1)}px`) };
      await pg.close();
    }
  }
  // ── Part 4: edge cases for the new markup
  if (PARTS.includes('4')) {
    const pg = await newPage(b, 320, errs);
    result.edge = await pg.evaluate(() => {
      const d = document.createElement('div'); document.body.appendChild(d);
      const sub = html => { d.innerHTML = noteHtml(html); return [...d.querySelectorAll('.note-cell-sub')].map(s => s.outerHTML); };
      return {
        // N1 several spaces after "•" (regex now \s+): all of them consumed, text starts after the box
        n1: sub('| a |\n| x<br>•    many spaces |'),
        // N2 "•" with no space ("•x") is not a bullet
        n2: sub('| a |\n| x<br>•x |'),
        // N3 only "• " (trimmed cell): split keeps "•" alone — not a bullet, plain remark
        n3: sub('| a |\n| x<br>• |'),
        // N4 markup after the mark is escaped, the only span inside is .note-mark
        n4: (() => { d.innerHTML = noteHtml('| a |\n| x<br>• <img src=x onerror=window.__xss=1><span class=note-mark>y</span> |'); return { img: d.querySelectorAll('img').length, marks: d.querySelectorAll('.note-mark').length, xss: window.__xss || 0 }; })(),
        // N5 non-bullet remark unchanged (no .note-mark)
        n5: sub('| a |\n| x<br>plain remark |'),
        // N6 a single "• " remark in the bold first column stays weight 400
        n6: (() => { d.innerHTML = noteHtml('| a | b |\n| x<br>• remark | y |'); const s = d.querySelector('.note-cell-sub.bullet'); return [getComputedStyle(s).fontWeight, getComputedStyle(s.querySelector('.note-mark')).fontWeight]; })(),
      };
    });
    await pg.close();
    const e = result.edge;
    ok(e.n1.length === 1 && /<span class="note-mark">• <\/span>many spaces<\/span>$/.test(e.n1[0]), 'N1 "•" + many spaces: one .note-mark, text without leading spaces ' + e.n1);
    ok(e.n2.length === 1 && !/bullet|note-mark/.test(e.n2[0]), 'N2 "•x" (no space) is a plain remark ' + e.n2);
    ok(e.n3.length === 1 && !/note-mark/.test(e.n3[0]), 'N3 a lone "•" remark is not a bullet ' + e.n3);
    ok(e.n4.img === 0 && e.n4.marks === 1 && e.n4.xss === 0, 'N4 markup after the mark escaped, only one .note-mark ' + JSON.stringify(e.n4));
    ok(e.n5.length === 1 && !/note-mark|bullet/.test(e.n5[0]), 'N5 plain remark has no .note-mark ' + e.n5);
    ok(e.n6[0] === '400' && e.n6[1] === '400', 'N6 bullet remark in the bold first column stays 400 ' + e.n6);
  }
  ok(errs.length === 0, 'no page / console errors: ' + errs.slice(0, 5).join('; '));
  result.errs = errs;
  const out = process.env.QA_OUT || '/tmp/qa-v1010-retest';
  fs.mkdirSync(out, { recursive: true });
  fs.writeFileSync(path.join(out, 'retest-' + (process.env.QA_TAG || 'head') + '.json'), JSON.stringify(result, null, 1));
  if (result.sweep) for (const [k, v] of Object.entries(result.sweep)) console.log(k.padEnd(20), JSON.stringify(v));
  if (result.overflow) for (const [k, v] of Object.entries(result.overflow)) if (v.over.length || v.broken.length) console.log('  ', k, 'over:', v.over.join(', '), '| broken:', v.broken.join(', '));
  if (result.fonts) console.log('fonts', JSON.stringify(result.fonts, null, 1));
  if (result.s171) console.log('s171', JSON.stringify(result.s171, null, 1));
  if (result.edge) console.log('edge', JSON.stringify(result.edge));
  bad.slice(0, 40).forEach(x => console.log('  BAD', x));
  console.log(`RETEST ${fail ? 'FAIL' : 'PASS'} ${pass}/${pass + fail}`);
  await b.close();
})().catch(e => { console.error(e); process.exit(1); });
