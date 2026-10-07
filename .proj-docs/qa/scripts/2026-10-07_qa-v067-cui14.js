// CUI-0014: lang spot checks (zh-HK and en) + visual parity vs base (screenshots + bounding boxes), seeded Math.random
const { chromium } = require('playwright-core');
const path = require('path'); const fs = require('fs');
const HEAD = path.resolve(process.argv[2]), BASE = path.resolve(process.argv[3]), OUT = process.argv[4], SHOTS = process.argv[5];
const sleep = ms => new Promise(r => setTimeout(r, ms));
let pass = 0, fail = 0; const ok = (c, m) => { c ? pass++ : fail++; console.log(c ? 'ok:' : 'FAIL:', m); };
const SEED = () => { let s = 12345; Math.random = () => { s = (s * 1103515245 + 12345) % 2147483648; return s / 2147483648; }; };
async function open(b, root, w, lang) {
  const ctx = await b.newContext({ viewport: { width: w, height: 844 }, deviceScaleFactor: 1 }); await ctx.addInitScript(SEED);
  const pg = await ctx.newPage(); const errs = []; pg.on('pageerror', e => errs.push(e.message));
  await pg.goto('file://' + path.join(root, 'index.html')); await pg.evaluate(() => localStorage.clear()); await pg.reload();
  if (lang === 'zh-HK') { await pg.click('#langBtn'); await sleep(80); }
  return { ctx, pg, errs };
}
// effective lang of every text node under selector: [{text, lang}]
const langOf = (pg, sel) => pg.$$eval(sel, els => els.map(el => { const out = []; const w = document.createTreeWalker(el, NodeFilter.SHOW_TEXT); let n;
  while ((n = w.nextNode())) if (n.data.trim()) out.push({ t: n.data.trim().slice(0, 30), l: n.parentElement.closest('[lang]').getAttribute('lang') }); return out; }));
// Exam 1: Q1 two wrong picks (multi), Q2..Q22 one wrong pick, Q23 unanswered, Q24 right; submit with real clicks
async function toResult(pg) {
  await pg.click('#modeExam'); await sleep(420); await pg.click('#examGrid [data-arg="1"]'); await sleep(420);
  await pg.evaluate(() => state.questions.forEach((q, i) => { const wrong = q.o.map((_, k) => k).filter(k => !q.a.includes(k));
    if (i === 22) return; state.answers[i] = i === 23 ? [...q.a] : wrong.slice(0, q.a.length); }));
  await pg.click('#navDots .dot:last-child'); await sleep(420); await pg.click('#nextBtn'); await sleep(420); await pg.click('#confirmOk'); await sleep(420);
}
async function toTimeline(pg) { await pg.click('#modeStudy'); await sleep(420); await pg.click('#studyTabs [data-tab="timeline"]'); await sleep(200); }
const boxes = (pg, sel) => pg.$$eval(sel, els => els.map(e => { const r = e.getBoundingClientRect(); return [r.x, r.y, r.width, r.height].map(v => Math.round(v * 100) / 100).join(','); }));
const shotEl = async (pg, sel, file) => { const h = await pg.$eval(sel, e => e.scrollHeight); await pg.setViewportSize({ width: pg.viewportSize().width, height: Math.min(h + 400, 16000) }); await sleep(100);
  const buf = await pg.$eval(sel, () => 0).then(() => pg.locator(sel).screenshot()); if (file) fs.writeFileSync(file, buf); return buf; };
async function pixelDiff(b, a, c) { if (a.equals(c)) return 0; const pg = await b.newPage();
  const n = await pg.evaluate(async ([x, y]) => { const load = s => new Promise(r => { const i = new Image(); i.onload = () => r(i); i.src = 'data:image/png;base64,' + s; });
    const [i1, i2] = await Promise.all([load(x), load(y)]); if (i1.width !== i2.width || i1.height !== i2.height) return `size ${i1.width}x${i1.height} vs ${i2.width}x${i2.height}`;
    const cv = document.createElement('canvas'); cv.width = i1.width; cv.height = i1.height; const g = cv.getContext('2d'); g.drawImage(i1, 0, 0); const d1 = g.getImageData(0, 0, cv.width, cv.height).data;
    g.clearRect(0, 0, cv.width, cv.height); g.drawImage(i2, 0, 0); const d2 = g.getImageData(0, 0, cv.width, cv.height).data; let k = 0; for (let p = 0; p < d1.length; p += 4) if (d1[p] !== d2[p] || d1[p + 1] !== d2[p + 1] || d1[p + 2] !== d2[p + 2]) k++; return k; }, [a.toString('base64'), c.toString('base64')]);
  await pg.close(); return n; }
(async () => {
  const b = await chromium.launch({ args: ['--no-sandbox'] });
  for (const lang of ['zh-HK', 'en']) {
    const OTHER = lang === 'en' ? 'zh-HK' : 'en';
    let { ctx, pg, errs } = await open(b, HEAD, 390, lang);
    ok(await pg.evaluate(() => document.documentElement.lang) === lang, `[${lang}] <html lang> = ${lang}`);
    // Home chapter grid
    await pg.click('#modePractice'); await sleep(420); await pg.click('#ptabChapter'); await sleep(100);
    const chName = await langOf(pg, '#chapterGrid .ch-name'); ok(chName.length === 5 && chName.flat().every(x => x.l === 'en'), `[${lang}] Home .ch-name ${chName.length} → en (${chName.flat().map(x => x.t).join(' / ')})`);
    const chNum = (await langOf(pg, '#chapterGrid .ch-num')).flat(); console.log(`  S-057 record [${lang}] .ch-num "${chNum[0].t}" → lang ${[...new Set(chNum.map(x => x.l))]}`);
    // Quiz note + fallback answer (practice Exam 1; find a question with note and one without oy for the answer)
    await pg.click('#ptabExam'); await sleep(80); await pg.click('#examGrid [data-arg="1"]'); await sleep(420);
    const info = await pg.evaluate(() => ({ note: state.questions.findIndex(q => q.note), noOy: state.questions.findIndex(q => q.a.some(ai => !(q.oy && q.oy[ai]))) }));
    for (const [k, idx] of Object.entries(info)) {
      if (idx < 0) { console.log(`  note: Exam 1 has no ${k} question`); continue; }
      await pg.click(`#navDots .dot:nth-child(${idx + 1})`); await sleep(420);
      const a = await pg.evaluate(() => state.questions[state.current].a); for (const i of a) { await pg.click(`#opt${i}`); await sleep(60); }
      if (k === 'note') { const s = (await langOf(pg, '#ansNote')).flat(); ok(s.length >= 2 && s.every(x => x.l === 'zh-HK'), `[${lang}] Quiz 💡 note label + text → zh-HK (${s.map(x => x.t).join(' | ').slice(0, 50)})`); }
      else { const s = await pg.evaluate(() => { const row = document.querySelectorAll('#ansYue .ans-yue-row')[1]; const sp = row.querySelector('b + span');
          return [...sp.childNodes].map(n => ({ t: n.textContent.trim(), l: (n.nodeType === 1 ? n : n.parentElement).closest('[lang]').getAttribute('lang') })).filter(x => x.t); });
        const fb = s.filter(x => x.l === 'en'); ok(fb.length >= 1 && s.every(x => x.l === 'en' || x.l === 'zh-HK'), `[${lang}] Quiz 答 row: English fallback → en, Cantonese → zh-HK (${JSON.stringify(s).slice(0, 90)})`); }
    }
    console.log('  pageerrors', errs.length); await ctx.close();
    // Result
    ({ ctx, pg, errs } = await open(b, HEAD, 390, lang)); await toResult(pg);
    const rv = await pg.$$eval('#reviewList .rv-your', els => els.map(e => ({ spans: e.querySelectorAll('[lang]').length, spanLang: e.querySelector('span') && e.querySelector('span').lang,
      label: e.firstChild.nodeType === 3 ? e.firstChild.data : '(not text)', labelLang: e.closest('[lang]').getAttribute('lang'), text: e.textContent })));
    const answered = rv.filter(r => r.spans), blank = rv.filter(r => !r.spans);
    ok(rv.length === 23 && answered.length === 22 && answered.every(r => r.spanLang === 'en' && r.labelLang === lang), `[${lang}] Result .rv-your: 23 wrong rows, 22 with exactly one span lang=en, label inherits ${lang} ("${answered[0].label}")`);
    ok(blank.length === 1 && /未作答|No answer/.test(blank[0].text), `[${lang}] Result unanswered row: no span, UI text "${blank[0] && blank[0].text}"`);
    const multi = answered.find(r => / \| |, |;/.test(r.text)) || answered[0]; console.log(`  [${lang}] multi wrong row: "${rv[0].text}"`);
    ok(rv[0].spans === 1, `[${lang}] Result multi-answer wrong pick (Q1, 2 options): one span holds both options`);
    const rvNote = (await langOf(pg, '#reviewList .rv-note')).flat(); ok(rvNote.length > 0 && rvNote.every(x => x.l === 'zh-HK'), `[${lang}] Result 💡 label + note → zh-HK (${rvNote.length} text nodes)`);
    // E: live switch on the Result screen → attributes survive the re-render
    await pg.click('#langBtn'); await sleep(120);
    const rv2 = await pg.$$eval('#reviewList .rv-your', els => els.map(e => ({ s: e.querySelectorAll('span[lang="en"]').length, l: e.closest('[lang]').getAttribute('lang') })));
    ok(rv2.length === 23 && rv2.filter(r => r.s === 1).length === 22 && rv2.every(r => r.l === OTHER), `[${lang}→${OTHER}] live switch on Result: 22 spans en kept, label now inherits ${OTHER}`);
    await pg.click('#langBtn'); await sleep(120);
    console.log('  pageerrors', errs.length); await ctx.close();
    // Study chapters + timeline
    ({ ctx, pg, errs } = await open(b, HEAD, 390, lang));
    await pg.click('#modeStudy'); await sleep(420); await pg.click('#studyTabs [data-tab="chapters"]'); await sleep(150);
    const gt = (await langOf(pg, '#studyContent .study-group-title')).flat(); ok(gt.length && gt.filter(x => !/^\d+$/.test(x.t)).every(x => x.l === 'en'), `[${lang}] Study chapter title → en ("${gt[0].t}")`);
    const chipTag = (await langOf(pg, '#studyContent .tag:not(.year):not(.person):not(.war)')).flat().filter(x => /Ch/.test(x.t)); if (chipTag.length) console.log(`  S-057 record [${lang}] study chapter tag "${chipTag[0].t}" → ${[...new Set(chipTag.map(x => x.l))]}`);
    await pg.click('#studyTabs [data-tab="timeline"]'); await sleep(150);
    const yr = (await langOf(pg, '#studyContent .tl-year')).flat(), ps = (await langOf(pg, '#studyContent .tag.person')).flat();
    ok(yr.length === 82 && yr.every(x => x.l === 'en'), `[${lang}] Timeline .tl-year ${yr.length} → en (e.g. ${yr.slice(0, 3).map(x => x.t).join(' / ')})`);
    ok(ps.length === 32 && ps.every(x => x.l === 'en'), `[${lang}] Timeline .tag.person ${ps.length} → en (e.g. ${ps[0].t})`);
    const bc = await pg.evaluate(() => ({ attr: yearLangAttr({ y: -55 }), label: yearLabel({ y: -55 }), ad: yearLangAttr({ y: 43 }), yl: yearLangAttr({ y: -3000, yl: 'c. 3000 BC' }) }));
    ok(bc.attr === '' && bc.ad === ' lang="en"' && bc.yl === ' lang="en"', `[${lang}] yearLangAttr: BC fallback (no yl) untagged → page lang ("${bc.label}"), AD → en, yl → en`);
    ok(errs.length === 0, `[${lang}] no page errors`); await ctx.close();
  }
  // Visual parity vs base: Result wrong rows + Study timeline, zh-HK and en, 390 and 320
  for (const lang of ['zh-HK', 'en']) for (const w of [390, 320]) {
    const got = {};
    for (const [tag, root] of [['head', HEAD], ['base', BASE]]) {
      let { ctx, pg } = await open(b, root, w, lang); await toResult(pg);
      const rb = await boxes(pg, '#reviewList .rv-your'); const rbuf = await shotEl(pg, '#reviewList', w === 320 && lang === 'zh-HK' ? path.join(OUT, `result_${lang}_${w}_${tag}.png`) : null);
      const rtext = await pg.$$eval('#reviewList .rv-your', els => els.map(e => e.textContent)); await ctx.close();
      ({ ctx, pg } = await open(b, root, w, lang)); await toTimeline(pg);
      const tb = await boxes(pg, '#studyContent .tl-year, #studyContent .tag.person, #studyContent .tag.year'); const tbuf = await shotEl(pg, '#studyContent', w === 320 && lang === 'zh-HK' ? path.join(OUT, `timeline_${lang}_${w}_${tag}.png`) : null); await ctx.close();
      got[tag] = { rb, rbuf, rtext, tb, tbuf };
    }
    const rd = await pixelDiff(b, got.head.rbuf, got.base.rbuf), td = await pixelDiff(b, got.head.tbuf, got.base.tbuf);
    ok(JSON.stringify(got.head.rtext) === JSON.stringify(got.base.rtext), `[${lang} ${w}] Result .rv-your text identical to base (${got.head.rtext.length} rows)`);
    ok(JSON.stringify(got.head.rb) === JSON.stringify(got.base.rb) && rd === 0, `[${lang} ${w}] Result wrong rows: ${got.head.rb.length} bounding boxes identical, screenshot pixel diff = ${rd}`);
    ok(JSON.stringify(got.head.tb) === JSON.stringify(got.base.tb) && td === 0, `[${lang} ${w}] Study timeline: ${got.head.tb.length} year/person boxes identical, screenshot pixel diff = ${td}`);
  }
  // copy the two zh-HK 320 timeline/result head shots to SHOTS for the report
  console.log(`${pass} passed, ${fail} failed`); await b.close();
})();
