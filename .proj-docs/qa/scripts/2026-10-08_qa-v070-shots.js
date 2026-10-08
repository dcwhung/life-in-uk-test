// QA v0.70 visual pass: screenshots + geometry metrics for one app root. node shots070.js <root> <outdir> <tag>
const { chromium } = require('playwright-core'); const path = require('path'); const fs = require('fs');
const ROOT = path.resolve(process.argv[2]); const OUT = path.resolve(process.argv[3]); const TAG = process.argv[4];
fs.mkdirSync(OUT, { recursive: true });
const WIDTHS = [320, 390, 900], LANGS = ['en', 'zh-HK'];
const metrics = {};
// pixel-based: year glyph ink rows vs dot ink rows in a screenshot of each timeline row
async function inkCentres(pg, buf, boxes) {
  return pg.evaluate(async ([b64, boxes]) => {
    const img = new Image(); img.src = 'data:image/png;base64,' + b64; await img.decode();
    const c = document.createElement('canvas'); c.width = img.width; c.height = img.height; const x = c.getContext('2d'); x.drawImage(img, 0, 0);
    const d = x.getImageData(0, 0, c.width, c.height).data; const W = c.width;
    const isInk = (px, py) => { const i = (py * W + px) * 4; const r = d[i], g = d[i + 1], bl = d[i + 2]; return Math.max(r, g, bl) - Math.min(r, g, bl) > 40 || r + g + bl < 450; };
    const rows = (x0, x1, y0, y1) => { const ys = []; for (let y = Math.max(0, y0); y < Math.min(c.height, y1); y++) { for (let xx = Math.max(0, x0); xx < Math.min(W, x1); xx++) if (isInk(xx, y)) { ys.push(y); break; } } return ys; };
    return boxes.map(bx => { const t = rows(bx.tx0, bx.tx1, bx.y0, bx.y1), dt = rows(bx.dx0, bx.dx1, bx.y0, bx.y1);
      return { year: bx.year, lines: bx.lines, textTop: t[0], textBot: t[t.length - 1], dotTop: dt[0], dotBot: dt[dt.length - 1],
        off: (t.length && dt.length) ? ((t[0] + t[t.length - 1]) / 2 - (dt[0] + dt[dt.length - 1]) / 2) : null }; });
  }, [buf.toString('base64'), boxes]);
}
(async () => {
  const b = await chromium.launch({ args: ['--no-sandbox'], executablePath: process.env.CHROMIUM_PATH });
  for (const lang of LANGS) for (const w of WIDTHS) {
    const key = `${lang}-${w}`; const M = metrics[key] = {};
    const pg = await b.newPage({ viewport: { width: w, height: 900 }, deviceScaleFactor: 2 });
    const errs = []; pg.on('pageerror', e => errs.push(e.message));
    await pg.goto('file://' + path.join(ROOT, 'index.html'));
    await pg.evaluate(l => { localStorage.clear(); localStorage.setItem('lifeuk.uiLang', JSON.stringify(l)); localStorage.setItem('lifeuk.installDismissed', 'true'); }, lang);
    await pg.reload(); await pg.addStyleTag({ content: 'header { position: static !important; } *, *::before, *::after { animation: none !important; transition: none !important; }' });
    const shot = async (name, sel, opts = {}) => { const el = typeof sel === 'string' ? await pg.$(sel) : sel; if (!el) { M['missing:' + name] = true; return; }
      await el.scrollIntoViewIfNeeded(); await el.screenshot({ path: path.join(OUT, `${name}-${key}.png`), ...opts }); };
    const overflow = () => pg.evaluate(() => document.documentElement.scrollWidth > innerWidth);
    // ── Study: every tab ──
    const views = { chapters: "studySetTab('chapters'); studySetChapter(3)", timeline: "studySetTab('timeline')", geo: "studySetTab('geo'); studySetNation(ALL_FILTER)", people: "studySetTab('people'); studySetGroup(ALL_FILTER)" };
    M.study = {};
    for (const [tab, js] of Object.entries(views)) {
      const r = await pg.evaluate(js => { openStudy(); new Function(js)(); window.scrollTo(0, 0);
        const cards = [...document.querySelectorAll('#studyContent .fact')]; const tol = 1; const bad = { src: [], stars: [], srcInline: 0, srcOwn: 0 };
        for (const c of cards) {
          const row = c.querySelector('.fact-src'); if (row) { const rr = row.getBoundingClientRect(), n = c.querySelector('.fact-src-nodes').getBoundingClientRect(),
            first = c.querySelector('.sqm-node').getBoundingClientRect(), bt = c.querySelector('.fact-practise').getBoundingClientRect();
            const wrapped = n.height > first.height + tol, own = bt.top >= n.bottom - tol, full = bt.width >= rr.width - tol;
            if ((wrapped && !own) || (own && !full) || bt.right > rr.right + tol || bt.left < rr.left - tol) bad.src.push(c.dataset.factId);
            if (own) bad.srcOwn++; else bad.srcInline++;
            // one-line nodes beside the pill: the pill should sit at the right edge
            if (!own && Math.abs(bt.right - rr.right) > tol) bad.src.push('notRight#' + c.dataset.factId);
          }
          const meta = c.querySelector('.fact-meta'), st = meta.querySelector('.stars');
          if (st) { const s = st.getBoundingClientRect(); const others = [...meta.children].filter(e => e !== st).map(e => e.getBoundingClientRect());
            if (!(others.every(o => s.top >= o.bottom - 0.5) && Math.abs(s.left - meta.getBoundingClientRect().left) <= 0.5)) bad.stars.push(c.dataset.factId); }
        }
        return { cards: cards.length, srcBad: bad.src.slice(0, 8), srcBadN: bad.src.length, srcOwn: bad.srcOwn, srcInline: bad.srcInline, starsBad: bad.stars.length, overflow: document.documentElement.scrollWidth > innerWidth };
      }, js);
      M.study[tab] = r;
      await pg.screenshot({ path: path.join(OUT, `study-${tab}-top-${key}.png`) });
    }
    // timeline: pixel check of every dot vs year ink + clips of 1-line / 2-line years
    await pg.evaluate(() => { openStudy(); studySetTab('timeline'); });
    const items = await pg.$$('#studyContent .tl-item');
    const tl = [];
    for (let i = 0; i < items.length; i++) {
      const bx = await items[i].evaluate(it => { const y = it.querySelector('.tl-year'); y.scrollIntoView({ block: 'center' }); const r = y.getBoundingClientRect();
        const rg = document.createRange(); rg.selectNodeContents(y); const lines = new Set([...rg.getClientRects()].map(x => Math.round(x.top))).size;
        return { year: y.textContent, lines, x: r.left, y: r.top, w: r.width, h: Math.min(r.height, 120), right: r.right }; });
      const clip = { x: bx.x, y: bx.y - 4, width: bx.w + 24, height: Math.max(40, bx.h + 8) };
      const buf = await pg.screenshot({ clip });
      const S = 2; const textW = Math.round((bx.w - 4) * S), dotX0 = Math.round((bx.w + 1) * S), dotX1 = Math.round((bx.w + 20) * S);
      const [res] = await inkCentres(pg, buf, [{ year: bx.year, lines: bx.lines, tx0: 0, tx1: textW, dx0: dotX0, dx1: dotX1, y0: 0, y1: Math.round(clip.height * S) }]);
      res.off = res.off === null ? null : res.off / S; tl.push(res);
    }
    const offs = tl.filter(t => t.off !== null).map(t => Math.abs(t.off));
    M.timeline = { n: tl.length, measured: offs.length, maxAbsOff: Math.max(...offs), meanAbsOff: offs.reduce((a, b) => a + b, 0) / offs.length,
      twoLine: tl.filter(t => t.lines > 1).map(t => `${t.year}:${t.off?.toFixed(2)}`), worst: tl.filter(t => t.off !== null).sort((a, b) => Math.abs(b.off) - Math.abs(a.off)).slice(0, 3).map(t => `${t.year}:${t.off.toFixed(2)}`) };
    // timeline clips: first items, two-line year
    const twoIdx = await pg.evaluate(() => [...document.querySelectorAll('#studyContent .tl-item')].findIndex(it => { const rg = document.createRange(); rg.selectNodeContents(it.querySelector('.tl-year')); return new Set([...rg.getClientRects()].map(x => Math.round(x.top))).size > 1; }));
    await shot('timeline-first', '#studyContent .tl-item');
    if (twoIdx >= 0) await shot('timeline-twoline', (await pg.$$('#studyContent .tl-item'))[twoIdx]); else M.noTwoLine = true;
    // fact cards: many sources (#21 in chapters), one source, two sources
    await pg.evaluate(() => { studySetTab('chapters'); studySetChapter(STUDY.find(f => f.id == 21).ch); });
    await shot('fact-21-many-src', '#studyContent .fact[data-fact-id="21"]');
    const ids = await pg.evaluate(() => { const cs = [...document.querySelectorAll('#studyContent .fact')]; const by = n => cs.find(c => c.querySelectorAll('.sqm-node').length === n)?.dataset.factId; return { one: by(1), two: by(2), three: by(3), four: by(4) }; });
    M.factIds = ids;
    for (const [k, id] of Object.entries(ids)) if (id) await shot(`fact-src-${k}`, `#studyContent .fact[data-fact-id="${id}"]`);
    // ── Home My Review tiles ──
    for (const [wn, fn] of [[0, 0], [0, 2], [1, 0], [1, 3], [30, 0], [30, 5]]) {
      await pg.evaluate(([wn, fn]) => { goHome(); startMode('practice'); wrongList = {}; for (let i = 0; i < wn; i++) wrongList[(1 + Math.floor(i / 24)) + '.' + (i % 24)] = true;
        practiceFlags = {}; for (let i = 0; i < fn; i++) practiceFlags['4.' + i] = true; setLS('wrongList', wrongList); setLS('practiceFlags', practiceFlags); renderModeSelection(); }, [wn, fn]);
      const t = await pg.evaluate(() => ({ shown: getComputedStyle(document.getElementById('myReview')).display !== 'none', wrong: document.getElementById('tileWrong').innerText.replace(/\s+/g, ' '),
        flag: document.getElementById('tileFlagged').innerText.replace(/\s+/g, ' '), wrongDisabled: document.getElementById('tileWrong').disabled,
        heights: [...document.querySelectorAll('.my-tile')].map(e => Math.round(e.getBoundingClientRect().height)), op: [...document.querySelectorAll('#tileWrong > *')].map(e => getComputedStyle(e).opacity) }));
      M[`tile-w${wn}-f${fn}`] = t;
      if (t.shown) await shot(`tiles-w${wn}-f${fn}`, '#myReview');
    }
    M.homeOverflow = await overflow();
    // ── Practice answer box + Results review notes ──
    const picks = await pg.evaluate(() => { const find = p => { for (let e = 1; e <= 17; e++) { const i = EXAMS[e].findIndex(p); if (i >= 0) return [e, i]; } return null; };
      return { crown: find(q => (q.note || '').startsWith('記憶法（三層）')), arrow: find(q => /\n→ /.test(q.note || '')), oscar: [14, 3],
        battles: find(q => /^記憶法（英國重要戰役/.test(q.note || '')),
        plain: find(q => (q.note || '').includes('\n') && !/^\s*[•◦→]/m.test(q.note)), single: find(q => q.note && !q.note.includes('\n') && q.note.length > 60) }; });
    M.picks = picks;
    for (const [name, p] of Object.entries(picks)) {
      if (!p) { M['nopick:' + name] = true; continue; }
      await pg.evaluate(([e, i]) => { goHome(); pendingMode = 'practice'; startExam(e); state.current = state.questions.findIndex(q => qKey(q) === e + "." + i); renderQuestion();
        const q = state.questions[state.current]; selectOption(q.o.findIndex((_, k) => !q.a.includes(k))); if (q.a.length > 1 && typeof revealAnswer === 'function' && !document.querySelector('.ans-note')?.textContent) { state.answers[state.current] = [q.o.findIndex((_, k) => !q.a.includes(k))]; revealAnswer(); } }, p);
      await pg.waitForTimeout(50);
      M['ans-' + name] = await pg.evaluate(() => { const n = document.getElementById('ansNote'); const rows = [...n.querySelectorAll('.rv-note-line')];
        // hanging indent: for each wrapped bullet row, 2nd line x == text start x after the marker
        const hang = rows.filter(r => r.querySelector('.note-mark')).map(r => { const m = r.querySelector('.note-mark').getBoundingClientRect(); const rg = document.createRange(); rg.selectNodeContents(r); const rects = [...rg.getClientRects()];
          const lines = [...new Set(rects.map(x => Math.round(x.top)))]; if (lines.length < 2) return null; const second = Math.min(...rects.filter(x => Math.round(x.top) === lines[1]).map(x => x.left)); return +(second - m.right).toFixed(2); }).filter(x => x !== null);
        return { rows: rows.length, bullets: rows.filter(r => r.classList.contains('bullet')).length, subs: rows.filter(r => r.classList.contains('sub')).length, marks: n.querySelectorAll('.note-mark').length,
          hangDelta: hang, label: n.querySelector('strong')?.textContent, overflow: document.documentElement.scrollWidth > innerWidth, text: n.innerText.slice(0, 80) }; });
      await shot(`ans-${name}`, '#ansNote');
    }
    // results review: exam mode, answer everything wrong in the exams that hold the picks, finish
    for (const e of [...new Set(Object.values(picks).filter(Boolean).map(p => p[0]))]) {
      await pg.evaluate(e => { goHome(); pendingMode = 'exam'; startExam(e); state.questions.forEach((q, i) => { state.answers[i] = [q.o.findIndex((_, k) => !q.a.includes(k))]; }); finishExam(); }, e);
      for (const [name, p] of Object.entries(picks)) { if (!p || p[0] !== e) continue;
        const idx = await pg.evaluate(([e, i]) => state.questions.findIndex(q => qKey(q) === e + "." + i), p);
        const item = (await pg.$$('#reviewList .review-item'))[idx];
        M['rv-' + name] = await item.evaluate(it => { const n = it.querySelector('.rv-note'); const rows = n ? [...n.querySelectorAll('.rv-note-line')] : [];
          return { rows: rows.length, marks: n ? n.querySelectorAll('.note-mark').length : 0, bullets: rows.filter(r => r.classList.contains('bullet')).length, subs: rows.filter(r => r.classList.contains('sub')).length }; });
        await shot(`rv-${name}`, item);
      }
    }
    M.resultOverflow = await overflow();
    M.errors = errs;
    await pg.close();
  }
  fs.writeFileSync(path.join(OUT, `metrics-${TAG}.json`), JSON.stringify(metrics, null, 1));
  await b.close();
})().catch(e => { console.error(e); process.exit(1); });
