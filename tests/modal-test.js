const { chromium } = require('playwright-core');
const path = require('path');
// v1.0.6 (user): destructive confirms (study plan off / reset, practice / completed exam resets) are red: red title,
// red Confirm, red single-line Cancel (focus shown as a tint, no outer ring); every modal's message is justified with
// its last line on the left; the ⓘ popover title is the app title (en / zh-HK)
const APP_URL = process.env.APP_URL || 'file://' + path.resolve(__dirname, '..', 'index.html');
const launchOpts = { args: ['--no-sandbox'] };
if (process.env.CHROMIUM_PATH) launchOpts.executablePath = process.env.CHROMIUM_PATH;
const assert = (c, m) => { if (!c) throw new Error('FAIL: ' + m); console.log('ok:', m); };
const TITLE_EN = 'Life in the UK Test · Exam Practice';
const TITLE_ZH = 'Life in the UK Test · 應試練習';
const DANGER = [
  ['study plan off', () => togglePlanFeature()],
  ['study plan reset', () => planAskReset()],
  ['practice reset', () => resetPracticeProgress()],
  ['completed exams reset', () => resetCompletedExams()],
];
const NORMAL = [
  ['submit exam', () => { startExam(1, EXAM_MODE); submitExam(); }],
  ['leave exam', () => { startExam(1, EXAM_MODE); goHome(); }], // S-132: focusCancel like the resets, but not red
];

const modalLook = pg => pg.evaluate(() => {
  const card = document.querySelector('#confirmModal .modal-card'), css = id => getComputedStyle(byId(id));
  const red = getComputedStyle(document.documentElement).getPropertyValue('--red').trim();
  const toRgb = hex => `rgb(${hex.slice(1).match(/../g).map(h => parseInt(h, 16)).join(', ')})`;
  const cancel = css('confirmCancel');
  return { open: byId('confirmModal').classList.contains('show'), danger: card.classList.contains('danger'), red: toRgb(red),
    title: css('confirmTitle').color, okBg: css('confirmOk').backgroundColor, cancelText: cancel.color,
    cancelBorder: cancel.borderTopColor, cancelBorderStyle: cancel.borderTopStyle, cancelOutline: cancel.outlineStyle,
    cancelShadow: cancel.boxShadow, cancelFocusVisible: byId('confirmCancel').matches(':focus-visible'), hyphens: css('confirmMsg').hyphens,
    focus: document.activeElement.id, align: css('confirmMsg').textAlign, alignLast: css('confirmMsg').textAlignLast,
    titleAlign: css('confirmTitle').textAlign };
});

async function open(pg, fn) {
  await pg.goto(APP_URL);
  await pg.evaluate(`(${fn.toString()})()`);
}

(async () => {
  const b = await chromium.launch(launchOpts);
  const pg = await b.newPage({ viewport: { width: 390, height: 844 } });
  const errs = []; pg.on('pageerror', e => errs.push(e.message));
  for (const [name, fn] of DANGER) {
    await open(pg, fn);
    const m = await modalLook(pg);
    assert(m.open && m.danger && m.title === m.red && m.okBg === m.red, `${name}: red title + red Confirm: ` + JSON.stringify(m));
    assert(m.cancelText === m.red && m.cancelBorder === m.red && m.cancelBorderStyle === 'solid' && m.cancelOutline === 'none' && m.focus === 'confirmCancel',
      `${name}: focused Cancel is red with a single border, no outer ring: ` + JSON.stringify(m));
    assert(!m.cancelFocusVisible || /inset/.test(m.cancelShadow), `${name}: W-043 keyboard focus thickens the border (inset 1px): ` + m.cancelShadow);
    assert(m.align === 'justify' && m.alignLast === 'left' && m.titleAlign === 'center' && m.hyphens === 'auto',
      `${name}: message justified (S-133 hyphenated), last line left; title centred`);
  }
  for (const [name, fn] of NORMAL) {
    await open(pg, fn);
    const m = await modalLook(pg);
    assert(m.open && !m.danger && m.title !== m.red && m.okBg !== m.red, `${name}: not red: ` + JSON.stringify(m));
    assert(m.align === 'justify' && m.alignLast === 'left', `${name}: message justified, last line left`);
  }
  // W-043: keyboard focus on the red Cancel = tint + inset border; hover alone = tint only
  await open(pg, DANGER[2][1]);
  await pg.keyboard.press('Tab');
  await pg.keyboard.press('Tab'); // Confirm → back to Cancel by keyboard (trapConfirmTab)
  const kb = await modalLook(pg);
  assert(kb.focus === 'confirmCancel' && kb.cancelFocusVisible && /inset/.test(kb.cancelShadow), 'W-043: keyboard-focused Cancel shows the inset border: ' + JSON.stringify(kb));
  await pg.evaluate(() => document.activeElement.blur());
  await pg.hover('#confirmCancel');
  const hov = await modalLook(pg);
  assert(hov.cancelShadow === 'none' && hov.cancelText === hov.red, 'W-043: hover alone is the tint only, no inset border: ' + hov.cancelShadow);
  await pg.click('#confirmCancel');
  // a red confirm followed by a normal one in the same page drops the red
  await open(pg, DANGER[2][1]);
  await pg.click('#confirmCancel');
  await pg.evaluate(NORMAL[0][1]);
  assert(!(await modalLook(pg)).danger, 'a normal confirm after a red one is not red');
  // ⓘ popover title = the app title
  await pg.goto(APP_URL);
  await pg.click('#infoBtn');
  assert(await pg.$eval('#infoTitle', e => e.textContent) === TITLE_EN, 'ⓘ title (en): ' + TITLE_EN);
  await pg.evaluate(() => setLang('zh-HK'));
  assert(await pg.$eval('#infoTitle', e => e.textContent) === TITLE_ZH, 'ⓘ title (zh-HK): ' + TITLE_ZH);
  assert(errs.length === 0, 'no page errors: ' + errs.join(';'));
  await b.close(); console.log('MODAL PASS');
})().catch(e => { console.error(e.message); process.exit(1); });
