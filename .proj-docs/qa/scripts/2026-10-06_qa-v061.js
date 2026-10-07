// QA v0.61 PWA lane (manual, not part of run-all.sh): CUI-0008 install prompt (accepted / dismissed / re-fire /
// double tap / prompt() reject + userChoice never settles / prompt() throws sync / appinstalled / desktop),
// S-022 ✕ hit area (28x28 look, 6px outset on all sides hits ✕, Install centre + edges stay Install, 320px viewport),
// and a banner-only visual comparison against a git ref (visual-diff.js has no banner-visible scenario).
//   NODE_PATH=/opt/node-tools/node_modules CHROMIUM_PATH=/opt/pw-browsers/chromium \
//     node .proj-docs/qa/scripts/2026-10-06_qa-v061.js <repo-root> <screenshot-dir> [base-ref=bab51fd]
const { chromium } = require('playwright-core');
const { execSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');
const ROOT = path.resolve(process.argv[2] || '.');
const SHOT_DIR = path.resolve(process.argv[3] || '.');
const BASE_REF = process.argv[4] || 'bab51fd';
const { startPagesServer } = require(path.join(ROOT, 'tests', 'pages-server.js'));
const launchOpts = { args: ['--no-sandbox'] };
if (process.env.CHROMIUM_PATH) launchOpts.executablePath = process.env.CHROMIUM_PATH;
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log('ok:', m); } else { fail++; console.log('FAIL:', m); } };
const MOBILE = { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true,
  userAgent: 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Mobile Safari/537.36' };
const DESKTOP = { viewport: { width: 1280, height: 900 } };
const KEY = 'lifeuk.installDismissed';

// fake beforeinstallprompt; mode: 'accepted' | 'dismissed' | 'reject' (prompt rejects, userChoice never settles)
// | 'throw' (prompt throws synchronously) | 'lateReject' (prompt resolves, userChoice rejects later)
const fire = (pg, mode = 'accepted') => pg.evaluate(m => {
  window.__prompted = 0;
  const e = new Event('beforeinstallprompt', { cancelable: true });
  if (m === 'reject') {
    e.prompt = () => { window.__prompted++; return Promise.reject(new DOMException('dup', 'InvalidStateError')); };
    e.userChoice = new Promise(() => {});
  } else if (m === 'throw') {
    e.prompt = () => { window.__prompted++; throw new DOMException('no activation', 'NotAllowedError'); };
    e.userChoice = new Promise(() => {});
  } else if (m === 'lateReject') {
    e.prompt = () => { window.__prompted++; return Promise.resolve(); };
    e.userChoice = new Promise((_, rej) => setTimeout(() => rej(new Error('late')), 50));
  } else {
    e.prompt = () => { window.__prompted++; return Promise.resolve(); };
    e.userChoice = Promise.resolve({ outcome: m });
  }
  window.dispatchEvent(e);
  return { prevented: e.defaultPrevented, visible: byId('installBanner').classList.contains('visible') };
}, mode);
const st = pg => pg.evaluate(k => ({ visible: byId('installBanner').classList.contains('visible'),
  stored: localStorage.getItem(k), prompted: window.__prompted }), KEY);
// promptInstall() resolves within ms, else 'timeout'
const runPrompt = (pg, ms = 1500) => pg.evaluate(t => Promise.race([
  promptInstall().then(() => 'resolved', e => 'rejected:' + e),
  new Promise(r => setTimeout(() => r('timeout'), t)),
]), ms);

function watchErrors(pg) {
  const errs = [];
  pg.on('pageerror', e => errs.push('pageerror: ' + e.message));
  pg.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text()); });
  return errs;
}

async function cui0008(b, base) {
  // ── desktop: fine pointer, banner never shows ──
  let ctx = await b.newContext(DESKTOP); let pg = await ctx.newPage(); const derrs = watchErrors(pg);
  await pg.goto(base);
  ok(!(await pg.evaluate(() => matchMedia('(pointer: coarse)').matches)), 'desktop: pointer is fine');
  let r = await fire(pg);
  ok(r.prevented && !r.visible, `desktop: event intercepted, banner hidden ${JSON.stringify(r)}`);
  ok(await runPrompt(pg) === 'resolved' && (await st(pg)).prompted === 1, 'desktop: deferred prompt still reachable via promptInstall()');
  ok(derrs.length === 0, 'desktop: no page / console errors ' + derrs.join('|'));
  await ctx.close();

  ctx = await b.newContext(MOBILE); pg = await ctx.newPage(); const errs = watchErrors(pg);
  await pg.goto(base);
  ok(await pg.evaluate(() => matchMedia('(pointer: coarse)').matches), 'mobile: pointer is coarse');

  // accepted
  r = await fire(pg, 'accepted'); ok(r.visible, 'accepted: banner shows');
  await pg.tap('#installBtn'); await pg.waitForTimeout(100);
  let s = await st(pg);
  ok(s.prompted === 1 && !s.visible && s.stored === null, `accepted (tap): prompt once, banner hidden, no dismiss key ${JSON.stringify(s)}`);

  // dismissed → hidden, key null; next event → banner back
  r = await fire(pg, 'dismissed'); ok(r.visible, 'dismissed: banner shows');
  await pg.tap('#installBtn'); await pg.waitForTimeout(100);
  s = await st(pg);
  ok(s.prompted === 1 && !s.visible && s.stored === null, `dismissed (tap): banner hidden, ${KEY} null ${JSON.stringify(s)}`);
  ok(await pg.evaluate(() => deferredPrompt === null), 'dismissed: deferredPrompt cleared');
  r = await fire(pg, 'accepted'); ok(r.visible, 'dismissed → next beforeinstallprompt: banner shows again');
  await pg.reload(); r = await fire(pg); ok(r.visible, 'dismissed → after reload + event: banner shows (cancel is not a ✕)');

  // double tap (real input) / double click / double Enter → prompt() once
  for (const [label, act] of [
    ['two taps', async () => { await pg.tap('#installBtn'); await pg.tap('#installBtn', { force: true }).catch(() => {}); }],
    ['dblclick', async () => { await pg.dblclick('#installBtn'); }],
    ['two Enter', async () => { await pg.focus('#installBtn'); await pg.keyboard.press('Enter'); await pg.keyboard.press('Enter'); }],
    ['Promise.all x3', async () => { await pg.evaluate(() => Promise.all([promptInstall(), promptInstall(), promptInstall()])); }],
  ]) {
    await fire(pg, 'dismissed');
    await act(); await pg.waitForTimeout(100);
    s = await st(pg);
    ok(s.prompted === 1 && !s.visible, `double activation (${label}): prompt() once, banner hidden ${JSON.stringify(s)}`);
  }

  // prompt() rejects + userChoice never settles (S-026 gap)
  r = await fire(pg, 'reject'); ok(r.visible, 'reject: banner shows');
  const res = await runPrompt(pg);
  s = await st(pg);
  ok(res === 'resolved', `reject + pending userChoice: promptInstall() resolves (${res})`);
  ok(!s.visible && s.stored === null && s.prompted === 1, `reject: banner hidden, key null ${JSON.stringify(s)}`);
  // via real tap too
  await fire(pg, 'reject'); await pg.tap('#installBtn'); await pg.waitForTimeout(150);
  ok(!(await st(pg)).visible, 'reject (tap): banner hidden');

  // prompt() throws synchronously (QA edge)
  await fire(pg, 'throw');
  ok(await runPrompt(pg) === 'resolved' && !(await st(pg)).visible, 'prompt() throws sync: promptInstall() resolves, banner hidden');
  // userChoice rejects after prompt resolved (QA edge)
  await fire(pg, 'lateReject');
  ok(await runPrompt(pg) === 'resolved' && !(await st(pg)).visible, 'userChoice rejects late: promptInstall() resolves, banner hidden');
  await pg.waitForTimeout(150);

  // no event yet → promptInstall() is a no-op
  ok(await pg.evaluate(() => deferredPrompt === null) && await runPrompt(pg) === 'resolved', 'no deferred event: promptInstall() no-op');

  // appinstalled
  r = await fire(pg); ok(r.visible, 'appinstalled: banner shows first');
  await pg.evaluate(() => window.dispatchEvent(new Event('appinstalled')));
  s = await st(pg);
  ok(!s.visible && s.stored === null, `appinstalled: banner hidden, key not written ${JSON.stringify(s)}`);
  // observation (review S-027): stale deferredPrompt kept after appinstalled
  const stale = await pg.evaluate(() => deferredPrompt !== null);
  console.log('  observation S-027: deferredPrompt still set after appinstalled =', stale);
  await pg.evaluate(() => window.dispatchEvent(new Event('appinstalled')));
  ok(!(await st(pg)).visible, 'appinstalled twice / with banner already hidden: no-op');

  // ✕ still dismisses for good (regression)
  await pg.evaluate(() => { deferredPrompt = null; });
  await fire(pg); await pg.tap('#installBanner .install-close');
  s = await st(pg); ok(!s.visible && s.stored === 'true', `✕ still stores ${KEY} ${JSON.stringify(s)}`);
  await pg.reload(); r = await fire(pg); ok(!r.visible, '✕ then reload + event: banner stays hidden');
  // dismissed key set: Install path via promptInstall() still hides nothing visible and does not throw
  ok(await runPrompt(pg) === 'resolved', 'dismissed-for-good + promptInstall(): resolves');

  await pg.waitForTimeout(200);
  ok(errs.length === 0, 'mobile: no page / console errors across all CUI-0008 cases ' + errs.join('|'));
  await ctx.close();
}

// elementFromPoint probe of ✕ / Install
const probe = (pg, d) => pg.evaluate(d => {
  const close = document.querySelector('#installBanner .install-close');
  const btn = byId('installBtn');
  const banner = byId('installBanner');
  const c = close.getBoundingClientRect(); const b = btn.getBoundingClientRect(); const bn = banner.getBoundingClientRect();
  const at = (x, y) => document.elementFromPoint(x, y);
  const cx = c.left + c.width / 2, cy = c.top + c.height / 2;
  const pse = getComputedStyle(close, '::before');
  return {
    size: `${c.width}x${c.height}`,
    hitTop: at(cx, c.top - d) === close, hitBottom: at(cx, c.bottom + d) === close,
    hitLeft: at(c.left - d, cy) === close, hitRight: at(c.right + d, cy) === close,
    hitCorner: at(c.right + d, c.top - d) === close,
    outside10: at(c.left - 10, cy) === close,
    installCentre: at(b.left + b.width / 2, b.top + b.height / 2) === btn,
    installLeft: at(b.left + 1, b.top + b.height / 2) === btn,
    installRight: at(b.right - 1, b.top + b.height / 2) === btn,
    // 3px in: the 8px border-radius makes the outermost corner pixel hit the banner (same at bab51fd)
    installTopRight: at(b.right - 3, b.top + 3) === btn,
    installBottomRight: at(b.right - 3, b.bottom - 3) === btn,
    cornerNeverClose: [[b.right - 1, b.top + 1], [b.right - 1, b.bottom - 1]].every(([x, y]) => at(x, y) !== close),
    gap: c.left - b.right,
    inBanner: c.top - 8 >= bn.top && c.bottom + 8 <= bn.bottom && c.right + 8 <= bn.right,
    pseudo: { content: pse.content, pos: pse.position, inset: [pse.top, pse.right, pse.bottom, pse.left].join(' '), bg: pse.backgroundColor },
    look: (() => { const cs = getComputedStyle(close); return { color: cs.color, bg: cs.backgroundColor, radius: cs.borderRadius, fs: cs.fontSize }; })(),
  };
}, d);

async function s022(b, base) {
  for (const vp of [{ width: 390, height: 844 }, { width: 320, height: 640 }]) {
    const ctx = await b.newContext({ ...MOBILE, viewport: vp }); const pg = await ctx.newPage(); const errs = watchErrors(pg);
    await pg.goto(base);
    await fire(pg);
    await pg.locator('#installBanner').scrollIntoViewIfNeeded();
    const h = await probe(pg, 6);
    console.log(`  ${vp.width}px probe:`, JSON.stringify(h));
    ok(h.size === '28x28', `${vp.width}px: ✕ looks 28x28 (${h.size})`);
    ok(h.hitTop && h.hitBottom && h.hitLeft && h.hitRight && h.hitCorner, `${vp.width}px: 6px outside ✕ on all sides + corner hits ✕`);
    ok(!h.outside10, `${vp.width}px: 10px outside ✕ (left) is not ✕ (hit area bounded at 8px)`);
    ok(h.installCentre && h.installLeft && h.installRight && h.installTopRight && h.installBottomRight && h.cornerNeverClose,
      `${vp.width}px: Install centre / left / right / corner edges still hit Install`);
    ok(h.gap >= 8, `${vp.width}px: gap between Install and ✕ >= 8px (${h.gap})`);
    ok(h.inBanner, `${vp.width}px: 44px hit area stays inside the banner`);
    ok(h.pseudo.bg === 'rgba(0, 0, 0, 0)', `${vp.width}px: ::before is transparent (${h.pseudo.bg})`);
    // real tap 6px outside ✕ on the left (towards Install) dismisses
    const c = await pg.locator('#installBanner .install-close').boundingBox();
    await pg.touchscreen.tap(c.x - 6, c.y + c.height / 2);
    const s = await st(pg);
    ok(!s.visible && s.stored === 'true', `${vp.width}px: touch tap 6px left of ✕ dismisses ${JSON.stringify(s)}`);
    // tap on Install right edge prompts, not dismisses
    await pg.evaluate(k => localStorage.removeItem(k), KEY); await pg.reload(); await fire(pg);
    const bb = await pg.locator('#installBtn').boundingBox();
    await pg.touchscreen.tap(bb.x + bb.width - 1, bb.y + bb.height / 2);
    await pg.waitForTimeout(100);
    const s2 = await st(pg);
    ok(s2.prompted === 1 && s2.stored === null, `${vp.width}px: tap at Install right edge prompts (not ✕) ${JSON.stringify(s2)}`);
    if (vp.width === 390) {
      await pg.reload(); await fire(pg);
      await pg.screenshot({ path: path.join(SHOT_DIR, '2026-10-06_v061_mobile-install-banner.png') });
      await pg.locator('#installBanner').screenshot({ path: path.join(SHOT_DIR, '2026-10-06_v061_mobile-install-banner-crop.png') });
      // hit-area overlay (debug only, injected style)
      await pg.addStyleTag({ content: '.install-close::before { background: rgba(255,0,0,.35) !important; }' });
      await pg.locator('#installBanner').screenshot({ path: path.join(SHOT_DIR, '2026-10-06_v061_mobile-install-banner-hitarea.png') });
    }
    ok(errs.length === 0, `${vp.width}px: no page / console errors ` + errs.join('|'));
    await ctx.close();
  }
}

// banner look vs BASE_REF: computed style + box of the banner subtree and a pixel crop
async function bannerSnapshot(b, base) {
  const ctx = await b.newContext(MOBILE); const pg = await ctx.newPage();
  await pg.goto(base); await fire(pg);
  await pg.locator('#installBanner').scrollIntoViewIfNeeded();
  const styles = await pg.evaluate(() => {
    const out = [];
    for (const el of [byId('installBanner'), ...byId('installBanner').querySelectorAll('*')]) {
      const cs = getComputedStyle(el); const r = el.getBoundingClientRect();
      const pick = {};
      for (const p of ['color', 'background-color', 'background-image', 'border-radius', 'font-size', 'font-weight', 'padding', 'margin',
        'width', 'height', 'display', 'outline', 'opacity', 'cursor']) pick[p] = cs.getPropertyValue(p);
      out.push({ tag: el.tagName + '.' + el.className, box: [r.x, r.y, r.width, r.height].map(Math.round).join(','), pick, text: el.textContent.trim() });
    }
    return out;
  });
  const png = await pg.locator('#installBanner').screenshot();
  await ctx.close();
  return { styles, png };
}

async function visualVsRef(b, cur) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'lifeuk-qa061-'));
  execSync(`git archive ${BASE_REF} | tar -x -C "${dir}"`, { cwd: ROOT, shell: '/bin/bash' });
  const { base: refBase, server } = await startPagesServer(dir);
  try {
    const a = await bannerSnapshot(b, refBase);
    const c = await bannerSnapshot(b, cur);
    const diffs = [];
    a.styles.forEach((x, i) => {
      const y = c.styles[i];
      if (!y || x.tag !== y.tag || x.box !== y.box || x.text !== y.text || JSON.stringify(x.pick) !== JSON.stringify(y.pick)) diffs.push({ ref: x, cur: y });
    });
    if (c.styles.length !== a.styles.length) diffs.push({ count: [a.styles.length, c.styles.length] });
    ok(diffs.length === 0, `banner computed style / box vs ${BASE_REF}: ${diffs.length} diffs ${diffs.length ? JSON.stringify(diffs).slice(0, 600) : ''}`);
    ok(a.png.equals(c.png), `banner pixel crop identical to ${BASE_REF} (${a.png.length} vs ${c.png.length} bytes)`);
    fs.writeFileSync(path.join(SHOT_DIR, `2026-10-06_v061_banner-${BASE_REF}-ref.png`), a.png);
  } finally {
    server.kill();
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

(async () => {
  const { base, server } = await startPagesServer(ROOT);
  const b = await chromium.launch(launchOpts);
  try {
    // version / SW cache name
    const ctx = await b.newContext(); const pg = await ctx.newPage();
    await pg.goto(base);
    const v = await pg.evaluate(() => APP_VERSION);
    ok(v === '0.61', `APP_VERSION === '0.61' (${v})`);
    const label = await pg.evaluate(() => [...document.querySelectorAll('.app-version')].map(e => e.textContent).join('|'));
    console.log('  version label:', label);
    await pg.evaluate(() => navigator.serviceWorker.ready);
    await pg.waitForFunction(async () => (await caches.keys()).includes('lifeuk-v0.61'), null, { timeout: 15000 }).catch(() => {});
    const keys = await pg.evaluate(() => caches.keys());
    ok(keys.includes('lifeuk-v0.61') && keys.length === 1, `SW cache = lifeuk-v0.61 only (${keys})`);
    await ctx.close();

    await cui0008(b, base);
    await s022(b, base);
    await visualVsRef(b, base);
  } catch (e) {
    fail++; console.log('FAIL: script threw', e);
  } finally {
    await b.close(); server.kill();
  }
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
