// QA v1.0.0: header / info-popover layout with the real (unmasked) version label, v0.72 (origin/main) vs v1.0.0,
// 320 / 360 / 375 px, en + zh-HK. Checks: label text, no wrap (single line), no overflow (label inside header-inner,
// no x-scroll), lang pill position/size unchanged vs old, header height unchanged; screenshot header crops.
//   node 2026-10-08_qa-v100-header.js <new-root> <old-root> <out-dir>
const { chromium } = require('playwright-core');
const fs = require('fs'); const path = require('path');
const [NEW, OLD, OUT] = process.argv.slice(2, 5).map(p => path.resolve(p));
fs.mkdirSync(OUT, { recursive: true });
let pass = 0, fail = 0; const ok = (c, m) => { if (c) pass++; else { fail++; console.log('FAIL:', m); } };
const measure = () => {
  const box = e => { const r = e.getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height, r: r.right, b: r.bottom }; };
  const v = document.getElementById('appVersion'), sub = v.parentElement, hi = document.querySelector('.header-inner'), lang = document.getElementById('langBtn');
  const lineH = parseFloat(getComputedStyle(sub).lineHeight) || parseFloat(getComputedStyle(sub).fontSize) * 1.6;
  return { text: v.textContent, rects: v.getClientRects().length, sub: box(sub), subLines: Math.round(sub.getBoundingClientRect().height / lineH), subScroll: sub.scrollWidth > sub.clientWidth + 0.5,
    v: box(v), hi: box(hi), lang: box(lang), langText: lang.textContent, header: box(document.querySelector('header')),
    logoText: box(document.querySelector('.logo-text')), scrollW: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth };
};
const popMeasure = () => { const p = document.getElementById('infoPop'), v = document.getElementById('appVersionPop'), h = v.parentElement;
  const r = p.getBoundingClientRect(), rv = v.getBoundingClientRect(); return { text: v.textContent, open: p.classList.contains('open') || getComputedStyle(p).display !== 'none', rects: v.getClientRects().length, inPop: rv.right <= r.right + 0.5 && rv.left >= r.left - 0.5, h2h: h.getBoundingClientRect().height, scrollW: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }; };
async function run(browser, root, w, lang) {
  const ctx = await browser.newContext({ viewport: { width: w, height: 740 }, deviceScaleFactor: 2 });
  const pg = await ctx.newPage(); const errs = []; pg.on('pageerror', e => errs.push(e.message));
  await pg.addInitScript(l => { try { localStorage.clear(); if (l !== 'en') localStorage.setItem('lifeuk.uiLang', JSON.stringify(l)); } catch (e) {} }, lang);
  await pg.goto('file://' + path.join(root, 'index.html')); await pg.evaluate(() => document.fonts.ready); await pg.waitForTimeout(200);
  const m = await pg.evaluate(measure);
  const png = await pg.screenshot({ clip: { x: 0, y: 0, width: w, height: Math.ceil(m.header.b) } });
  await pg.click('#infoBtn'); await pg.waitForTimeout(300);
  const p = await pg.evaluate(popMeasure);
  const popPng = await pg.screenshot({ fullPage: false });
  await ctx.close(); return { m, p, png, popPng, errs };
}
(async () => {
  const browser = await chromium.launch({ args: ['--no-sandbox'], executablePath: process.env.CHROMIUM_PATH });
  for (const w of [320, 360, 375]) for (const lang of ['en', 'zh-HK']) {
    const a = await run(browser, OLD, w, lang), b = await run(browser, NEW, w, lang); const t = `${w}/${lang}`;
    const n = b.m, o = a.m;
    ok(o.text === 'v0.72' && n.text === 'v1.0.0', `${t} header label ${o.text} -> ${n.text}`);
    ok(b.p.text === 'v1.0.0' && b.p.open, `${t} popover label ${b.p.text} open=${b.p.open}`);
    ok(n.rects === 1 && n.subLines === o.subLines && n.sub.h === o.sub.h, `${t} label single line, logo-sub height ${o.sub.h} -> ${n.sub.h}`);
    ok(!n.subScroll && n.v.r <= n.hi.r && n.v.r <= n.lang.x, `${t} label no overflow (label right ${n.v.r.toFixed(1)}, lang left ${n.lang.x.toFixed(1)})`);
    ok(n.scrollW <= n.cw && b.p.scrollW <= b.p.cw, `${t} no x-scroll ${n.scrollW}/${n.cw}`);
    ok(JSON.stringify(n.lang) === JSON.stringify(o.lang) && n.langText === o.langText, `${t} lang pill unchanged ${JSON.stringify(o.lang)} -> ${JSON.stringify(n.lang)}`);
    ok(n.header.h === o.header.h && n.logoText.w === o.logoText.w, `${t} header height ${o.header.h} -> ${n.header.h}`);
    ok(b.p.rects === 1 && b.p.inPop && b.p.h2h === a.p.h2h, `${t} popover label one line, inside pop, h2 height ${a.p.h2h} -> ${b.p.h2h}`);
    ok(!a.errs.length && !b.errs.length, `${t} page errors ${a.errs}|${b.errs}`);
    console.log(`${t}: label w ${o.v.w.toFixed(1)} -> ${n.v.w.toFixed(1)} | gap to lang pill ${(o.lang.x - o.v.r).toFixed(1)} -> ${(n.lang.x - n.v.r).toFixed(1)}px`);
    fs.writeFileSync(path.join(OUT, `hdr_${w}_${lang}_old.png`), a.png); fs.writeFileSync(path.join(OUT, `hdr_${w}_${lang}_new.png`), b.png);
    fs.writeFileSync(path.join(OUT, `pop_${w}_${lang}_new.png`), b.popPng);
  }
  await browser.close(); console.log(`\n${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
