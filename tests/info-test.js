const { chromium } = require('playwright-core');
const { seedLegacyDefaults } = require('./legacy-defaults'); // v1.4.2: keep the old en + small first run
const path = require('path');
const APP_URL = process.env.APP_URL || 'file://' + path.resolve(__dirname, '..', 'index.html');
const launchOpts = { args: ['--no-sandbox'] };
if (process.env.CHROMIUM_PATH) launchOpts.executablePath = process.env.CHROMIUM_PATH;
const POP_GUTTER_PX = 16; // the popover's side gap on a phone (user: use the full width)
// v2.0.0: 1024px and up is the desktop layout (1280px column; the ⓘ / ⚙ popovers sit under their buttons there, a
// desktop suite's job), so the widest pre-desktop width keeps checking the 780px column
const WIDE_PX = 1023;
const ARROW_TOL_PX = 2;
const MAIN_MAX_PX = 780; // css/base/tokens.css --content-max-w below 1024px
(async () => {
  const b = seedLegacyDefaults(await chromium.launch(launchOpts));
  const pg = await b.newPage({ viewport: { width: 390, height: 844 } });
  const errs = []; pg.on('pageerror', e => errs.push(e.message));
  const assert = (c, m) => { if (!c) throw new Error('FAIL: ' + m); console.log('ok:', m); };
  const vis = sel => pg.$eval(sel, e => getComputedStyle(e).display !== 'none');
  await pg.goto(APP_URL);
  assert((await pg.$$('.home-hero')).length === 0, 'hero removed from home');
  assert(await pg.$eval('#infoBtn', e => e.closest('.logo-text') !== null && getComputedStyle(e).borderStyle === 'none'), 'ⓘ next to title, no ring');
  assert(!(await vis('#infoPop')), 'popover hidden by default');
  await pg.click('#infoBtn');
  assert(await vis('#infoPop') && (await pg.$eval('#infoPop', e => e.textContent)).includes('480+ official-style questions, with Cantonese'), 'click shows tooltip with hero text (v2.7.0: 480+, no source site)');
  assert(!(await pg.$eval('#infoPop', e => e.textContent)).includes('lifeintheuktestweb'), 'v2.7.0: intro no longer names lifeintheuktestweb.co.uk');
  const badges = await pg.$$eval('#infoPop .hero-badge', els => els.map(e => e.textContent));
  assert(JSON.stringify(badges) === JSON.stringify(['📋 20 Exams', '📚 5 Chapters', '❓ 480+ Qs', '🔒 Works Offline']), 'four badges: Exams | Chapters | Qs | Offline: ' + badges.join(' | '));
  assert(await pg.$eval('#infoBtn', e => e.getAttribute('aria-expanded') === 'true'), 'aria-expanded true');
  // the "❓ 480+ Qs" badge reads as full words (user): role=img makes screen readers use its aria-label
  const qLabel = () => pg.$eval('#infoQuestionCount', e => ({ role: e.getAttribute('role'), label: e.getAttribute('aria-label') }));
  const qEn = await qLabel();
  assert(qEn.role === 'img' && qEn.label === '480+ questions', 'Qs badge is read as "480+ questions": ' + JSON.stringify(qEn));
  await pg.evaluate(() => setLang('zh-HK'));
  const qZh = await qLabel();
  assert(qZh.role === 'img' && qZh.label === '480+ 條題目', 'zh-HK Qs badge is read as "480+ 條題目": ' + JSON.stringify(qZh));
  await pg.evaluate(() => setLang('en'));
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
  await pg.waitForFunction(w => innerWidth === w && new Promise(r => requestAnimationFrame(() => r(true))), WIDE_PX); // the resize handler re-points the arrow a frame later
  const wide = await pg.$eval('#infoPop', e => e.getBoundingClientRect());
  const mainBox = await pg.$eval('main', e => e.getBoundingClientRect());
  assert(Math.round(wide.width) === MAIN_MAX_PX && Math.round(wide.left) === Math.round(mainBox.left), `wide screen: popover ${MAIN_MAX_PX}px, aligned with main: ` + JSON.stringify(wide));
  assert(await arrowUnderInfo(), 'wide screen: the arrow points at ⓘ');
  await pg.setViewportSize({ width: 390, height: 844 });
  await pg.screenshot({ path: path.join(__dirname, 'shot-info.png') });
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
