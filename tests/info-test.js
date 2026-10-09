const { chromium } = require('playwright-core');
const path = require('path');
const APP_URL = process.env.APP_URL || 'file://' + path.resolve(__dirname, '..', 'index.html');
const launchOpts = { args: ['--no-sandbox'] };
if (process.env.CHROMIUM_PATH) launchOpts.executablePath = process.env.CHROMIUM_PATH;
const POP_GUTTER_PX = 16; // the popover's side gap on a phone (user: use the full width)
const WIDE_PX = 1024;
const ARROW_TOL_PX = 2;
const MAIN_MAX_PX = 780; // css/base/layout.css main max-width
(async () => {
  const b = await chromium.launch(launchOpts);
  const pg = await b.newPage({ viewport: { width: 390, height: 844 } });
  const errs = []; pg.on('pageerror', e => errs.push(e.message));
  const assert = (c, m) => { if (!c) throw new Error('FAIL: ' + m); console.log('ok:', m); };
  const vis = sel => pg.$eval(sel, e => getComputedStyle(e).display !== 'none');
  await pg.goto(APP_URL);
  assert((await pg.$$('.home-hero')).length === 0, 'hero removed from home');
  assert(await pg.$eval('#infoBtn', e => e.closest('.logo-text') !== null && getComputedStyle(e).borderStyle === 'none'), 'ⓘ next to title, no ring');
  assert(!(await vis('#infoPop')), 'popover hidden by default');
  await pg.click('#infoBtn');
  assert(await vis('#infoPop') && (await pg.$eval('#infoPop', e => e.textContent)).includes('408 official-style questions'), 'click shows tooltip with hero text');
  const badges = await pg.$$eval('#infoPop .hero-badge', els => els.map(e => e.textContent));
  assert(JSON.stringify(badges) === JSON.stringify(['📋 17 Exams', '📚 5 Chapters', '❓ 408 Qs', '🔒 Works Offline']), 'four badges: Exams | Chapters | Qs | Offline: ' + badges.join(' | '));
  assert(await pg.$eval('#infoBtn', e => e.getAttribute('aria-expanded') === 'true'), 'aria-expanded true');
  const arrowUnderInfo = () => pg.evaluate(tol => {
    const pop = byId('infoPop'), arrow = getComputedStyle(pop, '::after'), btn = byId('infoBtn').getBoundingClientRect();
    const arrowX = pop.getBoundingClientRect().left + parseFloat(arrow.left) + parseFloat(arrow.width) / 2;
    return Math.abs(arrowX - (btn.left + btn.width / 2)) <= tol;
  }, ARROW_TOL_PX);
  assert(await arrowUnderInfo(), 'the arrow points at ⓘ');
  const box = await pg.$eval('#infoPop', e => e.getBoundingClientRect());
  assert(box.right <= 390 && box.left >= 0, 'popover fits viewport width');
  assert(box.left === POP_GUTTER_PX && box.right === 390 - POP_GUTTER_PX, `popover uses the full width less a ${POP_GUTTER_PX}px gutter: ` + JSON.stringify(box));
  // wide screen: the popover lines up with the 780px main column
  await pg.setViewportSize({ width: WIDE_PX, height: 844 });
  const wide = await pg.$eval('#infoPop', e => e.getBoundingClientRect());
  const mainBox = await pg.$eval('main', e => e.getBoundingClientRect());
  assert(Math.round(wide.width) === MAIN_MAX_PX && Math.round(wide.left) === Math.round(mainBox.left), `wide screen: popover ${MAIN_MAX_PX}px, aligned with main: ` + JSON.stringify(wide));
  assert(await arrowUnderInfo(), 'wide screen: the arrow points at ⓘ');
  await pg.setViewportSize({ width: 390, height: 844 });
  await pg.screenshot({ path: 'shot-info.png' });
  await pg.click('#infoBtn');
  assert(!(await vis('#infoPop')), 'second click hides');
  await pg.click('#infoBtn');
  await pg.click('#infoPop h2');
  assert(await vis('#infoPop'), 'click inside keeps it open');
  await pg.mouse.click(30, 760);
  assert(!(await vis('#infoPop')), 'click outside closes');
  await pg.click('#infoBtn'); await pg.keyboard.press('Escape');
  assert(!(await vis('#infoPop')), 'Escape closes');
  // still works on the quiz screen
  await pg.evaluate(() => { pendingMode = 'practice'; startExam(1); });
  await pg.click('#infoBtn');
  assert(await vis('#infoPop'), 'works on quiz screen');
  assert(errs.length === 0, 'no page errors: ' + errs.join(';'));
  await b.close(); console.log('INFO PASS');
})().catch(e => { console.error(e.message); process.exit(1); });
