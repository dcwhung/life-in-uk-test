const { chromium } = require('playwright-core');
const { seedLegacyDefaults } = require('./legacy-defaults'); // v1.4.2: keep the old en + small first run
const path = require('path');
// v1.2.0 (font size plan PR-B; mockup mockups/font-size-switch.html, grill .proj-docs/plans/2026-10-11_grill_font-size.md):
// - Q11: every "Home" button is a 🏠 icon button (SVG, aria-label + title Home / 主頁), Plan day "Schedule" is 📅 and the
//   schedule's "Change goal" is ✏️; each has a 44px tap area; a plan session's quiz back button keeps its words (named by
//   them, S-188)
// - Q11: the Study pill reads "🏆 n / 235" and is labelled "n of 235 facts mastered" (v1.3.2: 235 facts)
// - C2: the calendar's exam cell shows only its day; the legend ends with "[pattern] 🎯 Exam day" at the right end
// - C4: the Study tabs (five since v1.6.0, with 🧠 memo) are icon over label at every width
// - 320 / 360 / 390px, en + zh-HK: these headers stay on one row and the page never scrolls sideways
const APP_URL = process.env.APP_URL || 'file://' + path.resolve(__dirname, '..', 'index.html');
const launchOpts = { args: ['--no-sandbox'] };
if (process.env.CHROMIUM_PATH) launchOpts.executablePath = process.env.CHROMIUM_PATH;
const assert = (c, m) => { if (!c) throw new Error('FAIL: ' + m); console.log('ok:', m); };

const HIT_MIN_PX = 44;
const WIDTHS = [320, 360, 390];
const LANGS = ['en', 'zh-HK'];
const HOME_LABEL = { en: 'Home', 'zh-HK': '主頁' };
const GOAL = { examDate: '2026-10-22', dailyMins: 120, restDays: [0], level: 'none' };
const NOW = new Date('2026-10-11T09:00:00');
// Result's "Another Exam" buttons also go Home: not header buttons. v2.0.5: the quiz / Result header is goBack (🏠 while the
// session came from Home; js/screens/sideSession.js setEntryBack)
const HOME_BUTTONS = '.back-btn:is([data-action="goHome"], [data-action="goBack"])';

const fresh = async (pg, lang) => {
  await pg.goto(APP_URL);
  await pg.evaluate(() => localStorage.clear());
  await pg.goto(APP_URL);
  await pg.evaluate(l => setLang(l), lang);
};
const openPlan = (pg, screen) => pg.evaluate(({ goal, screen }) => {
  writeStudyPlan(buildPlan(goal, '2026-10-01'));
  if (screen === 'day') openPlanDay(); else openPlanSchedule();
}, { goal: GOAL, screen });
// the button's own box may be narrower than 44px; its ::before takes the rest, so probe by point on all four sides
const hitOk = (pg, sel) => pg.evaluate(({ s, min }) => {
  const e = document.querySelector(s);
  e.scrollIntoView({ block: 'center' });
  const r = e.getBoundingClientRect(), cx = r.left + r.width / 2, cy = r.top + r.height / 2, d = min / 2 - 1;
  const at = (x, y) => { const h = document.elementFromPoint(x, y); return !!h && (h === e || e.contains(h)); };
  return at(cx, cy - d) && at(cx, cy + d) && at(cx - d, cy) && at(cx + d, cy);
}, { s: sel, min: HIT_MIN_PX });
const iconButton = (pg, sel) => pg.$eval(sel, e => ({ icon: !!e.querySelector('svg.line-icon[aria-hidden="true"]'), text: e.textContent.trim(),
  label: e.getAttribute('aria-label'), title: e.getAttribute('title'), cls: e.classList.contains('icon-btn') }));
// the header row: every child on one line (no wrap), nothing past the screen edge
const headerRow = (pg, sel) => pg.$eval(sel, e => {
  const kids = [...e.children].filter(k => k.getClientRects().length);
  const tops = kids.map(k => Math.round(k.getBoundingClientRect().top + k.getBoundingClientRect().height / 2));
  return { oneRow: Math.max(...tops) - Math.min(...tops) <= 4, inside: kids.every(k => k.getBoundingClientRect().right <= innerWidth + 0.5),
    hScroll: document.documentElement.scrollWidth > innerWidth };
});

async function checkHomeButtons(pg, lang) {
  await fresh(pg, lang);
  const all = await pg.$$eval(HOME_BUTTONS, els => els.map(e => ({ screen: e.closest('.screen').id, icon: !!e.querySelector('svg.line-icon'),
    text: e.textContent.trim(), label: e.getAttribute('aria-label'), title: e.getAttribute('title'), cls: e.classList.contains('icon-btn') })));
  assert(all.length === 7 && all.every(b => b.icon && b.text === '' && b.cls && b.label === HOME_LABEL[lang] && b.title === HOME_LABEL[lang]),
    `${lang}: all 7 Home buttons are 🏠 icon buttons labelled ${HOME_LABEL[lang]}: ` + JSON.stringify(all.filter(b => !b.icon || b.label !== HOME_LABEL[lang])));
  await pg.evaluate(() => openStudy());
  assert(await hitOk(pg, `#screenStudy ${HOME_BUTTONS}`), `${lang}: Study 🏠 has a ${HIT_MIN_PX}px tap area`);
  await pg.click(`#screenStudy ${HOME_BUTTONS}`);
  assert(await pg.$eval('.screen.active', e => e.id) === 'screenHome', `${lang}: 🏠 goes Home`);
}

async function checkPlanIcons(pg, lang) {
  await fresh(pg, lang);
  await openPlan(pg, 'day');
  const cal = await iconButton(pg, '#screenPlanDay [data-action="openPlanSchedule"]');
  const sched = lang === 'en' ? 'Schedule' : '進度表';
  assert(cal.icon && cal.cls && cal.text === '' && cal.label === sched && cal.title === sched, `${lang}: Plan day "Schedule" is a 📅 icon button: ` + JSON.stringify(cal));
  assert(await hitOk(pg, '#screenPlanDay [data-action="openPlanSchedule"]') && await hitOk(pg, `#screenPlanDay ${HOME_BUTTONS}`), `${lang}: Plan day 🏠 / 📅 have ${HIT_MIN_PX}px tap areas`);
  await openPlan(pg, 'schedule');
  const pen = await iconButton(pg, '#screenPlanSchedule [data-action="planEditGoal"]');
  const goal = lang === 'en' ? 'Change goal' : '更改目標';
  assert(pen.icon && pen.cls && pen.text === '' && pen.label === goal && pen.title === goal, `${lang}: "Change goal" is a ✏️ icon button: ` + JSON.stringify(pen));
  assert(await hitOk(pg, '#screenPlanSchedule [data-action="planEditGoal"]'), `${lang}: ✏️ has a ${HIT_MIN_PX}px tap area`);
}

// a plan session keeps the words on the quiz back button ("‹ Today's tasks"), and its label follows them
async function checkPlanSessionBack(pg) {
  await fresh(pg, 'en');
  await openPlan(pg, 'day');
  await pg.click('#planTaskList .plan-task.practice.plan-task-btn'); // a practice task opens the quiz (a reading task opens Study)
  const back = await pg.$eval('#screenQuiz .back-btn', e => ({ text: e.textContent.trim(), label: e.getAttribute('aria-label'), title: e.getAttribute('title'), icon: !!e.querySelector('svg'), cls: e.classList.contains('icon-btn') }));
  assert(back.text.startsWith('‹') && !back.icon && !back.cls && back.label === null && back.title === null, 'plan session: the quiz back button keeps its words and they name it (S-188: no aria-label / title): ' + JSON.stringify(back));
  await pg.evaluate(() => { goHome(); pendingMode = 'practice'; startExam(1); });
  const home = await iconButton(pg, '#screenQuiz .back-btn');
  assert(home.icon && home.cls && home.text === '' && home.label === 'Home', 'a normal quiz after it: the back button is 🏠 again: ' + JSON.stringify(home));
}

async function checkStudyPill(pg, lang) {
  await fresh(pg, lang);
  await pg.evaluate(() => openStudy());
  const p = await pg.$eval('#studyProgress', e => ({ text: e.textContent, role: e.getAttribute('role'), label: e.getAttribute('aria-label'), title: e.title }));
  const label = lang === 'en' ? '0 of 235 facts mastered' : '已掌握 0 / 235 條知識點';
  assert(p.text === '🏆 0 / 235' && p.role === 'img' && p.label === label && p.title === label, `${lang}: Study pill 🏆 0 / 235, labelled ${label}: ` + JSON.stringify(p));
}

async function checkStudyTabs(pg, lang, w) {
  const tabs = await pg.$$eval('#studyTabs .study-tab', els => els.map(e => {
    const ic = e.querySelector('.tab-ic'), label = ic && ic.nextElementSibling;
    const a = ic && ic.getBoundingClientRect(), b = label && label.getBoundingClientRect();
    return { above: !!a && !!b && a.bottom <= b.top + 1, centred: !!a && !!b && Math.abs((a.left + a.right) / 2 - (b.left + b.right) / 2) <= 1,
      hidden: !!ic && ic.getAttribute('aria-hidden') === 'true', text: label ? label.textContent : '' };
  }));
  assert(tabs.length === 5 && tabs.every(t => t.above && t.centred && t.hidden && t.text && !/\p{Extended_Pictographic}/u.test(t.text)),
    `C4 ${lang} ${w}px: every Study tab is icon over label, the icon decorative: ` + JSON.stringify(tabs));
}

async function checkCalendar(pg, lang) {
  await fresh(pg, lang);
  await openPlan(pg, 'day');
  const r = await pg.evaluate(() => {
    const cell = document.querySelector('.plan-cell.exam');
    const legend = byId('planCalTitle').closest('.plan-card-box').querySelector('.plan-legend');
    const group = legend.querySelector('.plan-legend-exam'), lr = legend.getBoundingClientRect(), gr = group.getBoundingClientRect();
    return { cellText: cell.textContent.trim(), small: !!cell.querySelector('small'), label: cell.getAttribute('aria-label'),
      legendText: group.textContent.trim(), swatch: !!group.querySelector('.plan-swatch.plan-exam-pat'), right: Math.abs(lr.right - gr.right) <= 1 };
  });
  const exam = lang === 'en' ? 'Exam day' : '考試日';
  assert(r.cellText === '22' && !r.small && r.label.includes(exam), `C2 ${lang}: the exam cell shows only its day, still labelled ${exam}: ` + JSON.stringify(r));
  assert(r.legendText === `🎯 ${exam}` && r.swatch && r.right, `C2 ${lang}: legend ends with [pattern] 🎯 ${exam} at the right end: ` + JSON.stringify(r));
}

async function checkHeaderRows(pg, lang, w) {
  await fresh(pg, lang);
  const screens = [['study', () => pg.evaluate(() => openStudy()), '#screenStudy .quiz-header'],
    ['plan day', () => openPlan(pg, 'day'), '#screenPlanDay .quiz-header'],
    ['schedule', () => openPlan(pg, 'schedule'), '#screenPlanSchedule .quiz-header']];
  for (const [name, open, sel] of screens) {
    await open();
    const r = await headerRow(pg, sel);
    assert(r.oneRow && r.inside && !r.hScroll, `${lang} ${w}px ${name}: header on one row inside the screen, no sideways scroll: ` + JSON.stringify(r));
    if (name === 'study') await checkStudyTabs(pg, lang, w);
  }
  // L3 cancelled: with 🏠 / 📅 the day title fits (v1.1 cut it to "Today'…" at 320–360px)
  await openPlan(pg, 'day');
  const dayTitle = await pg.$eval('#planDayTitle', e => ({ full: e.scrollWidth <= e.clientWidth + 1, text: e.textContent }));
  assert(dayTitle.full, `${lang} ${w}px: Plan day title is not cut ("${dayTitle.text}")`);
}

(async () => {
  const b = seedLegacyDefaults(await chromium.launch(launchOpts));
  const errs = [];
  for (const lang of LANGS) {
    const pg = await b.newPage({ viewport: { width: 390, height: 844 } });
    await pg.clock.setFixedTime(NOW);
    pg.on('pageerror', e => errs.push(e.message));
    await checkHomeButtons(pg, lang);
    await checkPlanIcons(pg, lang);
    await checkStudyPill(pg, lang);
    await checkCalendar(pg, lang);
    for (const w of WIDTHS) {
      await pg.setViewportSize({ width: w, height: 760 });
      await checkHeaderRows(pg, lang, w);
    }
    await pg.close();
  }
  const pg = await b.newPage({ viewport: { width: 390, height: 844 } });
  await pg.clock.setFixedTime(NOW);
  pg.on('pageerror', e => errs.push(e.message));
  await checkPlanSessionBack(pg);
  assert(errs.length === 0, 'no page errors: ' + errs.join(' | '));
  await b.close();
  console.log('HEADER-ICONS PASS');
})().catch(e => { console.error(e.message); process.exit(1); });
