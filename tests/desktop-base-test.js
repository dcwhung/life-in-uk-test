// v2.0.0 desktop layout, stage 1 (handoff .proj-docs/plans/2026-10-12_handoff_desktop-layout.md §2 / §5 / §6):
// - ≥ 1024px: every --fs-* and --space-* token ×1.2; large text = (base + 2px) × 1.2; header height, logo, ⚙ and the
//   number dot cap ×1.2. Below 1024px not one pixel changes (1023px = 390px = the v1.4.x values)
// - header content and main are at most 1280px wide, centred
// - shared tools for the screens (js/components/fit.js, css/components/fit.css): .screen.is-fit one-screen shell,
//   .fit-panel scrolling panel, .fit-fade can-up / can-down fades, fitSteps(), isDesktop(), onRefit() / runRefits()
//   re-run after render, resize, language, text size and translation changes
const fs = require('fs');
const path = require('path');
const dt = require('./desktop-helpers');
const { assert } = dt;

const ROOT = path.resolve(__dirname, '..');
const read = f => fs.readFileSync(path.join(ROOT, f), 'utf8');
const DESKTOP_SCALE = 1.2;
const LARGE_STEP_PX = 2;
const CONTENT_MAX_PX = 1280;
const PHONE_CONTENT_MAX_PX = 780;
const EXTRA_WIDE = { width: 1600, height: 900 };
const PX_EPSILON = 0.02;
const near = (a, b) => Math.abs(a - b) <= PX_EPSILON;

// base values straight from tokens.css: the :root block and the large-text block (before any @media)
function tokenBlock(selector) {
  const css = read('css/base/tokens.css').replace(/\/\*[\s\S]*?\*\//g, '');
  const start = css.indexOf(selector + ' {');
  const body = css.slice(start, css.indexOf('}', start));
  return Object.fromEntries([...body.matchAll(/(--(?:fs|space)-[\w-]+)\s*:\s*([\d.]+)px/g)].map(m => [m[1], Number(m[2])]));
}
const BASE = tokenBlock(':root');
const LARGE = tokenBlock(':root[data-font-size="large"]');
const FS = Object.keys(BASE).filter(n => n.startsWith('--fs-'));
const SPACE = Object.keys(BASE).filter(n => n.startsWith('--space-'));
// other ×1.2 sizes (css/base/tokens.css): base px at < 1024px
const SIZES = { '--header-h': 58, '--header-logo-size': 36, '--header-btn-size': 32, '--dot-max-w': 30 };

async function measureTokens(page) {
  const out = {};
  for (const n of FS) out[n] = await dt.measurePx(page, `var(${n})`, 'font-size');
  for (const n of [...SPACE, ...Object.keys(SIZES)]) out[n] = await dt.measurePx(page, `var(${n})`);
  return out;
}
function mismatches(measured, expected) {
  return Object.keys(expected).filter(n => !near(measured[n], expected[n])).map(n => `${n} ${measured[n]} ≠ ${expected[n]}`);
}
const scaled = (values, k) => Object.fromEntries(Object.entries(values).map(([n, v]) => [n, v * k]));

async function checkTokens(b) {
  assert(FS.length >= 20 && SPACE.length >= 10 && Object.keys(LARGE).length === FS.length, `tokens.css: ${FS.length} --fs-* / ${SPACE.length} --space-* base values read`);
  const sizes = { ...SIZES, ...Object.fromEntries(SPACE.map(n => [n, BASE[n]])) };
  const small = { ...Object.fromEntries(FS.map(n => [n, BASE[n]])), ...sizes };
  const large = { ...Object.fromEntries(FS.map(n => [n, LARGE[n]])), ...sizes };
  assert(FS.every(n => near(LARGE[n], BASE[n] + LARGE_STEP_PX)), 'tokens.css large text is still base + 2px (phone)');
  for (const [fontSize, base] of [['small', small], ['large', large]]) {
    for (const viewport of [dt.VIEWPORTS.phone, dt.VIEWPORTS.belowDesktop]) {
      const { page } = await dt.openDesktop(b, { viewport, fontSize });
      const off = mismatches(await measureTokens(page), base);
      assert(off.length === 0, `${viewport.width}px ${fontSize}: every token keeps its v1.4 value (${Object.keys(base).length} checked)` + (off.length ? ': ' + off.join(', ') : ''));
      await page.close();
    }
    for (const viewport of dt.DESKTOP_VIEWPORTS) {
      const { page } = await dt.openDesktop(b, { viewport, fontSize });
      const off = mismatches(await measureTokens(page), scaled(base, DESKTOP_SCALE));
      assert(off.length === 0, `${viewport.width}px ${fontSize}: every token ×${DESKTOP_SCALE}` + (fontSize === 'large' ? ' of (base + 2px)' : '') + (off.length ? ': ' + off.join(', ') : ''));
      await page.close();
    }
  }
  // the text size switch on an open desktop page moves every --fs-* by 2px × 1.2
  const { page } = await dt.openDesktop(b, { viewport: dt.VIEWPORTS.small });
  await dt.applySettings(page, { fontSize: 'large' });
  const off = mismatches(await measureTokens(page), scaled(large, DESKTOP_SCALE));
  assert(off.length === 0, '1024px: ⚙ small → large re-scales on the open page' + (off.length ? ': ' + off.join(', ') : ''));
  await page.close();
}

// header height, logo, ⚙ and the number dot follow their tokens; header + main at most 1280px, centred
const headerBox = page => page.evaluate(() => {
  const box = el => { const r = el.getBoundingClientRect(); return { left: r.left, width: r.width, height: r.height }; };
  return {
    header: box(document.querySelector('header')), inner: box(document.querySelector('.header-inner')),
    main: box(document.querySelector('main')), logo: box(document.querySelector('.logo-icon')),
    gear: box(byId('settingsBtn')), vw: document.documentElement.clientWidth,
  };
});
async function checkHeader(b) {
  for (const viewport of [dt.VIEWPORTS.small, dt.VIEWPORTS.wide, EXTRA_WIDE]) {
    const { page } = await dt.openDesktop(b, { viewport });
    const h = await headerBox(page);
    assert(near(h.header.height, SIZES['--header-h'] * DESKTOP_SCALE) && near(h.inner.height, SIZES['--header-h'] * DESKTOP_SCALE),
      `${viewport.width}px: header ${h.header.height}px high (58 × 1.2)`);
    assert(near(h.logo.width, SIZES['--header-logo-size'] * DESKTOP_SCALE) && near(h.gear.width, SIZES['--header-btn-size'] * DESKTOP_SCALE),
      `${viewport.width}px: logo ${h.logo.width}px, ⚙ ${h.gear.width}px (×1.2)`);
    // CUI-0031: the header content box is laid out like main (at most 1280px wide with main's inline padding inside)
    assert(near(h.inner.width, Math.min(CONTENT_MAX_PX, h.vw)) && near(h.inner.left, (h.vw - h.inner.width) / 2), `${viewport.width}px: header content ${h.inner.width}px wide, centred (max ${CONTENT_MAX_PX})`);
    assert(near(h.main.width, Math.min(CONTENT_MAX_PX, h.vw)) && near(h.main.left, (h.vw - h.main.width) / 2), `${viewport.width}px: main ${h.main.width}px wide, centred (max ${CONTENT_MAX_PX})`);
    await page.close();
  }
  const { page } = await dt.openDesktop(b, { viewport: dt.VIEWPORTS.belowDesktop });
  const h = await headerBox(page);
  assert(h.header.height === SIZES['--header-h'] && h.main.width === PHONE_CONTENT_MAX_PX && h.logo.width === SIZES['--header-logo-size'],
    `1023px: header 58px, main ${PHONE_CONTENT_MAX_PX}px, logo 36px as before`);
  await page.evaluate(() => { pendingMode = 'practice'; startExam(1); });
  const dotMax = await page.$eval('#navDots .dot', e => getComputedStyle(e).maxWidth);
  assert(dotMax === SIZES['--dot-max-w'] + 'px', '1023px: the number dot cap stays 30px: ' + dotMax);
  await dt.setViewport(page, dt.VIEWPORTS.small);
  const dotMaxDesk = parseFloat(await page.$eval('#navDots .dot', e => getComputedStyle(e).maxWidth));
  assert(near(dotMaxDesk, SIZES['--dot-max-w'] * DESKTOP_SCALE), '1024px: the number dot cap ×1.2: ' + dotMaxDesk);
  await page.close();
}

// CUI-0031 (user 2026-10-12: line them up): at any desktop width the header's logo and ⚙ sit on main's content edges
// (the first card's left, main's content right), with no jump where the viewport passes 1280 + the padding
const ALIGN_WIDTHS = [1024, 1280, 1328, 1440, 1920];
const ALIGN_SLACK_PX = 0.5;
const PHONE_HEADER_PAD_PX = 20;
const edges = page => page.evaluate(() => {
  const r = el => el.getBoundingClientRect();
  const main = document.querySelector('main'), cs = getComputedStyle(main);
  const card = byId('planCard');
  return {
    logo: r(document.querySelector('.logo-icon')).left, gear: r(byId('settingsBtn')).right,
    cardLeft: r(card).left, cardRight: r(card).right, cardShown: r(card).width > 0,
    mainLeft: r(main).left + parseFloat(cs.paddingLeft), mainRight: r(main).right - parseFloat(cs.paddingRight),
    vw: document.documentElement.clientWidth,
  };
});
async function checkHeaderAlign(b) {
  const { page } = await dt.openDesktop(b, { viewport: dt.VIEWPORTS.wide });
  for (const width of ALIGN_WIDTHS) {
    await dt.setViewport(page, { width, height: 800 });
    const e = await edges(page);
    const ok = (a, c) => Math.abs(a - c) <= ALIGN_SLACK_PX;
    assert(e.cardShown && ok(e.logo, e.cardLeft) && ok(e.logo, e.mainLeft),
      `CUI-0031 ${width}px: the logo's left on the first card's / main's content left (${e.logo.toFixed(1)} / ${e.cardLeft.toFixed(1)} / ${e.mainLeft.toFixed(1)})`);
    assert(ok(e.gear, e.mainRight) && ok(e.gear, e.cardRight),
      `CUI-0031 ${width}px: ⚙'s right on main's content right / the card's right (${e.gear.toFixed(1)} / ${e.mainRight.toFixed(1)} / ${e.cardRight.toFixed(1)})`);
  }
  // below 1024px the header keeps its own 20px padding and the 780px column (the phone layout never changes)
  for (const width of [dt.VIEWPORTS.belowDesktop.width, dt.VIEWPORTS.phone.width]) {
    await dt.setViewport(page, { width, height: 800 });
    const e = await edges(page);
    const was = (e.vw - Math.min(PHONE_CONTENT_MAX_PX, e.vw - 2 * PHONE_HEADER_PAD_PX)) / 2;
    assert(Math.abs(e.logo - was) <= PX_EPSILON && Math.abs(e.vw - e.gear - was) <= PX_EPSILON,
      `${width}px: the logo / ⚙ stay ${was}px in, as before (${e.logo} / ${e.vw - e.gear})`);
  }
  await page.close();
}

async function checkNoSideScroll(b) {
  await dt.forEachCase(b, async ({ page, label, errors }) => {
    const r = await dt.noHorizontalScroll(page);
    assert(r.ok && errors.length === 0, `${label}: Home has no sideways scroll (${r.detail}), no page error`);
  }, { translations: [true] });
}

// a stand-in one-screen screen: a header row, then a fading panel with a long list
const FAKE_FIT_SCREEN = () => {
  const s = document.createElement('section');
  s.className = 'screen is-fit';
  s.id = 'screenFitProbe';
  s.innerHTML = '<div class="quiz-header"><span class="quiz-label">probe</span></div>'
    + '<div class="fit-fade" id="probeFade"><div class="fit-panel" id="probePanel">'
    + Array.from({ length: 80 }, (_, i) => `<p>row ${i}</p>`).join('') + '</div></div>';
  document.querySelector('main').appendChild(s);
  showScreen('screenFitProbe');
};
async function checkShell(b) {
  const { page } = await dt.openDesktop(b, { viewport: dt.VIEWPORTS.small });
  await page.evaluate(FAKE_FIT_SCREEN);
  await page.evaluate(() => runRefits());
  const only = await dt.panelOnlyScroll(page, '#probePanel');
  assert(only.ok, '1024px .screen.is-fit: the page does not scroll, the .fit-panel does: ' + only.detail);
  const geo = await page.evaluate(() => {
    const s = byId('screenFitProbe');
    return { display: getComputedStyle(s).display, dir: getComputedStyle(s).flexDirection, bottom: s.getBoundingClientRect().bottom, vh: innerHeight };
  });
  const pad = await dt.measurePx(page, 'var(--space-10)');
  assert(geo.display === 'flex' && geo.dir === 'column' && near(geo.bottom, geo.vh - pad), `is-fit: flex column ending one --space-10 above the viewport bottom (${geo.bottom} / ${geo.vh})`);
  for (const viewport of [dt.VIEWPORTS.wide, { width: 1280, height: 600 }]) {
    await dt.setViewport(page, viewport);
    const r = await dt.panelOnlyScroll(page, '#probePanel');
    assert(r.ok, `${viewport.width}×${viewport.height}: still one screen high after a resize: ` + r.detail);
  }
  await dt.setViewport(page, dt.VIEWPORTS.belowDesktop);
  const phone = await page.evaluate(() => ({ display: getComputedStyle(byId('screenFitProbe')).display, overflow: getComputedStyle(byId('probePanel')).overflowY }));
  const pageScroll = await dt.pageNotScrolling(page);
  assert(phone.display === 'block' && phone.overflow === 'visible' && !pageScroll.ok, '1023px: is-fit / fit-panel do nothing, the page scrolls as before');
  await page.close();
}

// fitSteps on a fixed-height box: each step class shrinks the content; steps are added until it fits
const FIT_STEPS_PROBE = () => {
  const style = document.createElement('style');
  style.textContent = '#stepBox { height: 100px; overflow: hidden; } #stepBox .c { height: 150px; } #stepBox.s1 .c { height: 120px; }'
    + ' #stepBox.s1.s2 .c { height: 100px; } #stepBox.s1.s2.s3 .c { height: 60px; } #stepBox .c.t2 { height: 90px; } #stepBox.short .c { height: 40px; }';
  document.head.appendChild(style);
  const box = document.createElement('div');
  box.id = 'stepBox';
  box.innerHTML = '<div class="c"></div>';
  document.querySelector('main').prepend(box);
};
async function checkFitSteps(b) {
  const { page } = await dt.openDesktop(b, { viewport: dt.VIEWPORTS.small });
  await page.evaluate(FIT_STEPS_PROBE);
  const run = (steps, pre = []) => page.evaluate(([s, p]) => {
    const box = byId('stepBox');
    box.className = p.join(' ');
    box.querySelector('.c').className = 'c';
    const used = fitSteps(box, s.map(x => (Array.isArray(x) ? [box.querySelector(x[0]), x[1]] : x)));
    return { used, cls: box.className.split(' ').filter(Boolean), inner: box.querySelector('.c').className, over: box.scrollHeight > box.clientHeight + 1 };
  }, [steps, pre]);
  let r = await run(['s1', 's2', 's3']);
  assert(r.used === 2 && r.cls.join() === 's1,s2' && !r.over, 'fitSteps: adds s1, s2 and stops once it fits (s3 not added): ' + JSON.stringify(r));
  r = await run(['s1', 's2', 's3'], ['s1', 's2', 's3']);
  assert(r.used === 2 && r.cls.join() === 's1,s2', 'fitSteps: starts from none (a left-over s3 is removed), so a second run gives the same result');
  r = await run(['s1', 's2', 's3'], ['short']);
  assert(r.used === 0 && r.cls.join() === 'short', 'fitSteps: content that fits gets no step');
  r = await run(['s1', ['.c', 't2']]);
  assert(r.used === 2 && r.inner === 'c t2' && !r.over, 'fitSteps: a [element, class] step puts the class on that element');
  r = await run(['s9']);
  assert(r.used === 1 && r.over, 'fitSteps: every step used and still over: the last state stays (the panel scrolls)');
  await dt.setViewport(page, dt.VIEWPORTS.belowDesktop);
  r = await run(['s1', 's2', 's3'], ['s1']);
  assert(r.used === 0 && r.cls.join() === '' && !(await page.evaluate(() => isDesktop())), '1023px: isDesktop() false; fitSteps removes its steps and adds none');
  r = await page.evaluate(() => { const box = byId('stepBox'); box.className = ''; return fitSteps(box, ['s1', 's2'], { anyWidth: true }); });
  assert(r === 2, '1023px: { anyWidth: true } fits at any width');
  await dt.setViewport(page, dt.VIEWPORTS.small);
  assert(await page.evaluate(() => isDesktop()), '1024px: isDesktop() true');
  await page.close();
}

const fadeState = page => page.evaluate(() => {
  const w = byId('probeFade');
  return { up: w.classList.contains('can-up'), down: w.classList.contains('can-down'), after: getComputedStyle(w, '::after').opacity, before: getComputedStyle(w, '::before').opacity };
});
async function checkFades(b) {
  const { page } = await dt.openDesktop(b, { viewport: dt.VIEWPORTS.small });
  await page.evaluate(FAKE_FIT_SCREEN);
  await page.evaluate(() => runRefits());
  await page.waitForTimeout(300); // the fade transition
  let f = await fadeState(page);
  assert(!f.up && f.down && f.after === '1' && f.before === '0', 'fade at the top: can-down only, the bottom fade shows: ' + JSON.stringify(f));
  await page.$eval('#probePanel', el => { el.scrollTop = el.scrollHeight / 3; el.dispatchEvent(new Event('scroll')); });
  f = await fadeState(page);
  assert(f.up && f.down, 'fade mid-way: can-up and can-down');
  await page.$eval('#probePanel', el => { el.scrollTop = el.scrollHeight; el.dispatchEvent(new Event('scroll')); });
  f = await fadeState(page);
  assert(f.up && !f.down, 'fade at the bottom: can-up only');
  await page.$eval('#probePanel', el => { el.innerHTML = '<p>one row</p>'; });
  await page.evaluate(() => runRefits());
  f = await fadeState(page);
  assert(!f.up && !f.down, 'short content: no fade (refreshed by runRefits)');
  const listeners = await page.evaluate(() => { const p = byId('probePanel'); watchFade(p); watchFade(p); return p.dataset.fitFadeWatched; });
  assert(listeners === '1', 'watchFade is idempotent (one scroll listener per panel)');
  await page.close();
}

// onRefit: one registry re-run after resize, language, text size and translation changes, and by runRefits()
async function checkRefit(b) {
  const { page, errors } = await dt.openDesktop(b, { viewport: dt.VIEWPORTS.small });
  await page.evaluate(() => {
    window.refitCalls = { all: 0, home: 0, quiz: 0, desktopArg: [] };
    onRefit(desktop => { refitCalls.all++; refitCalls.desktopArg.push(desktop); });
    onRefit(() => { refitCalls.home++; }, 'screenHome');
    onRefit(() => { refitCalls.quiz++; }, 'screenQuiz');
  });
  const calls = () => page.evaluate(() => ({ ...refitCalls }));
  let before = await calls();
  await dt.setViewport(page, dt.VIEWPORTS.wide);
  let now = await calls();
  assert(now.all === before.all + 1 && now.home === before.home + 1 && now.quiz === before.quiz, 'resize: one run (frame-throttled); a screen-scoped fit runs only on its active screen');
  before = now;
  await page.click('#settingsBtn');
  await page.click('#settingsLangRow [data-arg="zh-HK"]');
  now = await calls();
  assert(now.all > before.all && now.home > before.home, 'language switch (⚙) re-runs the fits');
  before = now;
  await page.click('#settingsBtn');
  await page.click('#settingsFontRow [data-arg="large"]');
  now = await calls();
  assert(now.all > before.all, 'text size switch (⚙) re-runs the fits');
  before = now;
  await page.click('#settingsBtn');
  await page.click('#translationSwitch');
  now = await calls();
  assert(now.all > before.all, 'translation switch (⚙) re-runs the fits');
  await page.evaluate(() => { pendingMode = 'practice'; startExam(1); });
  before = await calls();
  await page.evaluate(() => runRefits());
  now = await calls();
  assert(now.quiz === before.quiz + 1 && now.home === before.home, 'runRefits() (a render tail) runs the active screen\'s fits only');
  await dt.setViewport(page, dt.VIEWPORTS.belowDesktop);
  now = await calls();
  assert(now.desktopArg[now.desktopArg.length - 1] === false, 'below 1024px the fits still run, told isDesktop() = false (to undo their steps)');
  assert(errors.length === 0, 'no page error: ' + errors.join(' | '));
  await page.close();
}

// S-233: a fit that renders (and so calls runRefits() again) does not start a nested run
async function checkRefitGuard(b) {
  const { page } = await dt.openDesktop(b, { viewport: dt.VIEWPORTS.small });
  const calls = await page.evaluate(() => {
    let n = 0;
    onRefit(() => { n++; runRefits(); });
    runRefits();
    return n;
  });
  assert(calls === 1, `S-233: runRefits() inside a fit does not nest (${calls} run)`);
  await page.close();
}

// W-377 / S-235 / S-228: js/components/deskPlace.js, the one way a screen moves parts into desktop columns
async function checkDeskPlace(b) {
  const { page, errors } = await dt.openDesktop(b, { viewport: dt.VIEWPORTS.wide });
  await page.evaluate(() => {
    const host = document.createElement('div');
    host.id = 'placeHost';
    host.innerHTML = '<p id="pA">a</p><button id="pB">b</button><p id="pC">c</p>';
    document.body.append(host);
  });
  const spec = "({ key: 'probe', boxClass: 'probe-cols', columns: [{ cls: 'probe-l', parts: [byId('pA')] }, { cls: 'probe-r', parts: [byId('pB'), byId('pC')] }] })";
  const look = () => page.evaluate(() => ({ html: [...byId('placeHost').childNodes].filter(n => n.nodeType === 1).map(n => n.id || n.className).join(' '),
    focus: document.activeElement && document.activeElement.id, box: window.probeBox && window.probeBox.isConnected }));
  await page.evaluate(sp => { byId('pB').focus(); window.probeBox = setDesktopColumns(eval(sp), true); }, spec);
  let l = await look();
  assert(l.html === 'probe-cols' && l.focus === 'pB', 'setDesktopColumns on: the parts in their columns, focus kept (S-228): ' + JSON.stringify(l));
  await page.evaluate(sp => setDesktopColumns(eval(sp), false), spec);
  l = await look();
  assert(l.html === 'pA pB pC' && !l.box && l.focus === 'pB', 'off: each part back in its place, the box out of the DOM, focus kept: ' + JSON.stringify(l));
  const same = await page.evaluate(sp => setDesktopColumns(eval(sp), true) === window.probeBox, spec);
  assert(same, 'on again: the same box is reused (built once)');
  assert(errors.length === 0, 'no page error: ' + errors.join(' | '));
  await page.close();
}

// W-377: a cached shell whose fit.js arrives late (js/main.js LATE_BOOT_SCRIPTS, after the screens): the screens'
// fits still register (lazily, at their first render), so the desktop layout works from the first screen
// a cached older shell (no tag for the file): the file fails once, LATE_BOOT_SCRIPTS loads it late, and Home / Quiz
// still get their desktop layout with no page error
async function checkLateScript(b, file, id) {
  const ctx = await b.newContext({ viewport: dt.VIEWPORTS.wide });
  let blocked = 0;
  await ctx.route(`**/${file}`, route => (blocked++ ? route.continue() : route.abort()));
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto(dt.APP_URL);
  await page.waitForFunction(() => typeof runRefits === 'function' && typeof deskKeepFocus === 'function' && byId('examGrid').children.length > 0);
  await dt.nextFrame(page);
  const name = file.split('/').pop();
  assert(blocked >= 2, `${name} failed once and was loaded late`);
  assert(await page.evaluate(() => !!document.querySelector('#screenHome .home-cols')), `${id} late ${name}: Home still gets its desktop columns`);
  await page.evaluate(() => { pendingMode = 'practice'; startExam(1); });
  assert(await page.evaluate(() => !!byId('navDots').closest('.quiz-dots-bar')), `${id} late ${name}: the quiz desktop layout too`);
  assert(errors.length === 0, 'no page error: ' + errors.join(' | '));
  await ctx.close();
}
async function checkLateFit(b) {
  await checkLateScript(b, 'js/components/fit.js', 'W-377');
  await checkLateScript(b, 'js/components/deskPlace.js', 'S-237');
}

// "add a new file" rules (HANDOFF.md): index.html tag, sw.js SHELL, LATE_BOOT_*, APP_VERSION
function checkFiles() {
  const html = read('index.html'), sw = read('sw.js'), main = read('js/main.js');
  assert(/APP_VERSION = '2\.0\.0'/.test(read('js/core/config.js')), 'APP_VERSION 2.0.0');
  for (const f of ['js/components/fit.js', 'css/components/fit.css', 'js/components/deskPlace.js']) {
    assert(html.includes(`"${f}"`) && sw.includes(`'${f}'`) && main.includes(`'${f}'`), `${f}: index.html tag, sw.js SHELL, js/main.js LATE_BOOT list`);
  }
  assert(html.indexOf('js/components/fit.js') < html.indexOf('js/screens/home.js'), 'fit.js loads before the screens');
  assert(html.indexOf('js/components/deskPlace.js') < html.indexOf('js/screens/home.js'), 'deskPlace.js loads before the screens');
}

(async () => {
  checkFiles();
  const b = await dt.launch();
  await checkTokens(b);
  await checkHeader(b);
  await checkHeaderAlign(b);
  await checkNoSideScroll(b);
  await checkShell(b);
  await checkFitSteps(b);
  await checkFades(b);
  await checkRefit(b);
  await checkRefitGuard(b);
  await checkDeskPlace(b);
  await checkLateFit(b);
  await b.close();
  console.log('PASS');
})().catch(e => { console.error(e.message || e); process.exit(1); });
