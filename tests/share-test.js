const { chromium } = require('playwright-core');
const path = require('path');
// v2.6.0 (mockup mockups/share-settings.html A): the header share button left of ⚙
// - share + ⚙ in one group, ⚙ still rightmost, 4px apart; icon button labelled Share / 分享; 44px tap each, no overlap
// - 320 / 390px, en + zh-HK: the header stays on one row, nothing past the screen edge
// - navigator.share present → called with the title, the localized text and the app folder URL (no ?query / #hash)
// - the sheet cancelled (AbortError) → no toast; navigator.share missing or refused → link copied + toast; no clipboard → toast with the link
// - link preview: description + og:title / og:description / og:image (absolute) in index.html
const APP_URL = process.env.APP_URL || 'file://' + path.resolve(__dirname, '..', 'index.html');
const launchOpts = { args: ['--no-sandbox'] };
if (process.env.CHROMIUM_PATH) launchOpts.executablePath = process.env.CHROMIUM_PATH;
const assert = (c, m) => { if (!c) throw new Error('FAIL: ' + m); console.log('ok:', m); };

const HIT_MIN_PX = 44;
const GAP_PX = 4;
const LABEL = { en: 'Share', 'zh-HK': '分享' };
const TEXT = { en: '400+ practice questions · Cantonese translations · Works offline', 'zh-HK': '400+ 條模擬試題 · 廣東話翻譯 · 離線可用' };
const TITLE = { en: 'Life in the UK Test · Exam Practice', 'zh-HK': 'Life in the UK Test · 應試練習' };
const COPIED = { en: 'Link copied', 'zh-HK': '已複製連結' };
const PREVIEW = '400+ practice questions · Cantonese translations · Works offline｜400+ 條模擬試題 · 廣東話翻譯 · 離線可用';

// stub navigator.share / clipboard before the app runs; mode: 'ok' | 'abort' | 'deny' | 'none'; clip: true | false
const stub = (pg, mode, clip = true) => pg.addInitScript(({ mode, clip }) => {
  window.__shared = null; window.__copied = null;
  const err = name => Object.assign(new Error(name), { name });
  if (mode === 'none') delete Navigator.prototype.share;
  else Object.defineProperty(navigator, 'share', { configurable: true, value: async d => {
    if (mode === 'abort') throw err('AbortError');
    if (mode === 'deny') throw err('NotAllowedError');
    window.__shared = d;
  } });
  Object.defineProperty(navigator, 'clipboard', { configurable: true, value: clip
    ? { writeText: async s => { window.__copied = s; } }
    : { writeText: async () => { throw err('NotAllowedError'); } } });
}, { mode, clip });

const open = async (browser, { lang = 'en', mode = 'ok', clip = true, width = 390, url = APP_URL } = {}) => {
  const pg = await browser.newPage({ viewport: { width, height: 800 } });
  await stub(pg, mode, clip);
  await pg.goto(APP_URL);
  await pg.evaluate(() => localStorage.clear());
  await pg.goto(url);
  await pg.evaluate(l => setLang(l), lang); // splash + intro skip automated runs (js/screens/intro.js)
  return pg;
};
const toast = pg => pg.evaluate(() => { const e = byId('appToast'); return e && !e.hidden ? e.textContent : null; });
const hitOk = (pg, sel) => pg.evaluate(({ s, min }) => {
  const e = document.querySelector(s), r = e.getBoundingClientRect(), cx = r.left + r.width / 2, cy = r.top + r.height / 2, d = min / 2 - 1;
  const at = (x, y) => { const h = document.elementFromPoint(x, y); return !!h && (h === e || e.contains(h)); };
  const share = s === '#shareBtn', half = byId('settingsBtn').getBoundingClientRect().left - byId('shareBtn').getBoundingClientRect().right;
  // the gap splits: up to 1px short of half of it (subpixel layout) beyond the inner edge is still this button
  const inner = share ? at(r.right + half / 2 - 1, cy) : at(r.left - half / 2 + 1, cy);
  return { v: at(cx, cy - d) && at(cx, cy + d), outer: share ? at(cx - d, cy) : at(cx + d, cy), centre: at(cx, cy) && inner };
}, { s: sel, min: HIT_MIN_PX });

(async () => {
  const browser = await chromium.launch(launchOpts);

  // markup + layout
  for (const lang of ['en', 'zh-HK']) for (const width of [320, 390]) {
    const pg = await open(browser, { lang, width });
    const g = await pg.evaluate(() => {
      const s = byId('shareBtn').getBoundingClientRect(), c = byId('settingsBtn').getBoundingClientRect();
      const inner = document.querySelector('.header-inner');
      return { sameParent: byId('shareBtn').parentElement === byId('settingsBtn').parentElement, gap: c.left - s.right,
        oneRow: Math.abs((s.top + s.bottom) - (c.top + c.bottom)) < 2, gearRight: c.right <= inner.getBoundingClientRect().right + 0.5,
        vw: document.documentElement.clientWidth, sw: document.documentElement.scrollWidth,
        label: byId('shareBtn').getAttribute('aria-label'), title: byId('shareBtn').title, icon: !!byId('shareBtn').querySelector('svg.line-icon[data-icon-name="share"]') };
    });
    const tag = `${lang} ${width}px`;
    assert(g.sameParent && g.oneRow && g.gearRight && Math.round(g.gap) === GAP_PX, `${tag}: share left of ⚙ in one group, ${GAP_PX}px apart, one row`);
    assert(g.sw <= g.vw, `${tag}: no sideways scroll`);
    assert(g.icon && g.label === LABEL[lang] && g.title === LABEL[lang], `${tag}: share icon labelled ${LABEL[lang]}`);
    const hs = await hitOk(pg, '#shareBtn'), hg = await hitOk(pg, '#settingsBtn');
    assert(hs.v && hs.outer && hs.centre && hg.v && hg.outer && hg.centre, `${tag}: 44px tap on the outer sides, the gap between them split in half`);
    await pg.close();
  }

  // share sheet path
  for (const lang of ['en', 'zh-HK']) {
    const pg = await open(browser, { lang, url: APP_URL + '?v=2#x' });
    await pg.click('#shareBtn');
    await pg.waitForFunction(() => window.__shared);
    const d = await pg.evaluate(() => window.__shared);
    assert(d.title === TITLE[lang] && d.text === TEXT[lang], `${lang}: navigator.share gets the title + localized text`);
    assert(d.url.endsWith('/') && !/[?#]/.test(d.url), `${lang}: shares the app folder URL without ?query / #hash (${d.url})`);
    assert(await toast(pg) === null && await pg.evaluate(() => window.__copied) === null, `${lang}: no copy / toast when the sheet opened`);
    await pg.close();
  }

  // cancelled
  let pg = await open(browser, { mode: 'abort' });
  await pg.click('#shareBtn');
  await pg.waitForTimeout(200);
  assert(await toast(pg) === null && await pg.evaluate(() => window.__copied) === null, 'cancelling the sheet does nothing');
  await pg.close();

  // no share / refused → copy + toast
  for (const [mode, lang] of [['none', 'en'], ['deny', 'zh-HK']]) {
    pg = await open(browser, { mode, lang });
    await pg.click('#shareBtn');
    await pg.waitForFunction(() => window.__copied);
    assert(await toast(pg) === COPIED[lang] && (await pg.evaluate(() => window.__copied)).endsWith('/'), `share ${mode}: link copied, toast "${COPIED[lang]}"`);
    await pg.close();
  }

  // no clipboard either → toast shows the link
  pg = await open(browser, { mode: 'none', clip: false });
  await pg.click('#shareBtn');
  await pg.waitForFunction(() => { const e = byId('appToast'); return e && !e.hidden; });
  const msg = await toast(pg);
  assert(msg.startsWith('Copy this link: ') && msg.endsWith('/'), 'no clipboard: the toast shows the link to copy');

  // link preview meta
  const raw = require('fs').readFileSync(path.resolve(__dirname, '..', 'index.html'), 'utf8'); // what a link crawler reads (no JS)
  assert(raw.includes(`<meta name="description" content="${PREVIEW}">`) && raw.includes(`<meta property="og:description" content="${PREVIEW}">`), 'index.html ships the preview line as written');
  const meta = await pg.evaluate(() => {
    const m = s => (document.querySelector(s) || {}).content;
    return { d: m('meta[name="description"]'), t: m('meta[property="og:title"]'), od: m('meta[property="og:description"]'), img: m('meta[property="og:image"]'), url: m('meta[property="og:url"]') };
  });
  assert(meta.d === PREVIEW && meta.od === PREVIEW, 'after JS (app.description): description + og:description still the preview line');
  assert(meta.t === 'Life in the UK Test · Exam Practice', 'og:title');
  assert(/^https:\/\//.test(meta.img) && /^https:\/\//.test(meta.url), 'og:image / og:url are absolute');
  await pg.close();

  await browser.close();
  console.log('PASS');
})().catch(e => { console.error(e.message); process.exit(1); });
