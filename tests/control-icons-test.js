const { chromium } = require('playwright-core');
const path = require('path');
// v1.6.1 (user 2026-10-12: "controls use line icons, never glyphs / emoji"): every button that used a glyph as its icon
// (← → ↩ ✓ ▶ 🔁 ↺ ✕ ‹ ›) now carries an SVG line icon (js/components/icons.js lineIconSvg, svg.line-icon, aria-hidden)
// and plain words; the icon sits where the glyph was (leading / trailing), icon-only buttons are named by aria-label +
// title. Walks Home, Quiz (Practice / Exam / side session / plan task / memo test), Study, Flagged, Memo, Plan goal /
// schedule / day / runner at 320 / 360 / 390px × en / zh-HK × small / large text:
// - no button (or role=button) text holds one of the glyphs; status / content inside a control is not a control icon
//   (STATUS_PARTS: day pills, task type emoji, task status line, memo badge), see HANDOFF › 已知限制
// - each control in scope has its icon (data-icon-name) at the expected end, the icon centred on the label line,
//   nothing overflowing the button and no sideways page scroll
const APP_URL = process.env.APP_URL || 'file://' + path.resolve(__dirname, '..', 'index.html');
const launchOpts = { args: ['--no-sandbox'] };
if (process.env.CHROMIUM_PATH) launchOpts.executablePath = process.env.CHROMIUM_PATH;
const assert = (c, m) => { if (!c) throw new Error('FAIL: ' + m); console.log('ok:', m); };

const GLYPHS = '←→↩✓▶🔁↺✕‹›';
const STATUS_PARTS = '.plan-pill, .plan-task-ic, .plan-task-st, .memo-badge';
const WIDTHS = [320, 360, 390];
const LANGS = ['en', 'zh-HK'];
const SIZES = ['small', 'large'];
const TODAY = '2026-10-01';
const START = '2026-09-28'; // Day 4 = TODAY (plan-run-test): reading + practice tasks, Days 1–3 carried over
const GOAL = { examDate: '2026-10-29', dailyMins: 120, restDays: [0], level: 'none' };
const CENTRE_TOL_PX = 2.5;

// every button / role=button in the document (hidden screens included): its text without status parts
const glyphButtons = pg => pg.evaluate(({ glyphs, status }) => [...document.querySelectorAll('button, [role="button"]')].map(b => {
  const c = b.cloneNode(true);
  c.querySelectorAll(status).forEach(s => s.remove());
  return { id: b.id || b.className || b.dataset.action, text: c.textContent.replace(/\s+/g, ' ').trim() };
}).filter(b => [...glyphs].some(g => b.text.includes(g))), { glyphs: GLYPHS, status: STATUS_PARTS });

// one control: its icons (names, in order), where they sit and the layout
const controlInfo = (pg, sel) => pg.evaluate(sel => {
  const b = document.querySelector(sel);
  if (!b) return null;
  const icons = [...b.querySelectorAll('svg.line-icon')];
  const kids = [...b.children].filter(k => k.getClientRects().length);
  const label = kids.find(k => k.tagName !== 'svg');
  const shown = b.getClientRects().length > 0;
  const mid = r => (r.top + r.bottom) / 2;
  const br = b.getBoundingClientRect(), lr = label && label.getBoundingClientRect();
  return {
    shown, text: b.textContent.replace(/\s+/g, ' ').trim(), names: icons.map(i => i.dataset.iconName),
    hidden: icons.every(i => i.getAttribute('aria-hidden') === 'true'),
    lead: !!kids[0] && kids[0].tagName === 'svg', trail: kids.length > 1 && kids[kids.length - 1].tagName === 'svg',
    label: b.getAttribute('aria-label'), title: b.getAttribute('title'),
    centred: !shown || !lr || icons.every(i => Math.abs(mid(i.getBoundingClientRect()) - mid(lr)) <= 2.5),
    fits: !shown || b.scrollWidth <= b.clientWidth + 1, inside: !shown || br.right <= innerWidth + 0.5,
    iconPx: icons.map(i => Math.round(i.getBoundingClientRect().height)),
  };
}, sel);

// spec: [selector, where ('lead' | 'trail' | 'both' | 'only' = icon button | 'icon' = an icon inside a labelled control), icon names]
async function checkControls(pg, tag, specs) {
  const bad = [];
  for (const [sel, where, names] of specs) {
    const c = await controlInfo(pg, sel);
    if (!c) { bad.push({ sel, missing: true }); continue; }
    const pos = where === 'only' ? c.text === '' && !!c.label && c.label === c.title
      : where === 'icon' ? c.text === '' : where === 'lead' ? c.lead && !c.trail : where === 'trail' ? c.trail && !c.lead : c.lead && c.trail;
    const ok = pos && c.hidden && names.join() === c.names.join() && c.centred && c.fits && c.inside;
    if (!ok) bad.push({ sel, where, names, got: c });
  }
  assert(!bad.length, `${tag}: ${specs.length} controls have their line icons, centred, nothing overflows: ` + JSON.stringify(bad));
  const glyph = await glyphButtons(pg);
  assert(!glyph.length, `${tag}: no button text holds ${GLYPHS}: ` + JSON.stringify(glyph));
  assert(await pg.evaluate(() => document.scrollingElement.scrollWidth <= innerWidth), `${tag}: no sideways scroll`);
}

async function fresh(pg, lang, size) {
  await pg.clock.setFixedTime(new Date(`${TODAY}T09:00:00`));
  await pg.goto(APP_URL);
  await pg.evaluate(({ lang, size }) => {
    localStorage.clear();
    localStorage.setItem('lifeuk.uiLang', JSON.stringify(lang));
    localStorage.setItem('lifeuk.fontSize', JSON.stringify(size));
  }, { lang, size });
  await pg.goto(APP_URL);
}
const seedPlan = (pg, { ok = {}, bad = {} } = {}) => pg.evaluate(({ goal, start, ok, bad }) => {
  writeStudyPlan(buildPlan(goal, start));
  const days = Object.fromEntries(Object.keys({ ...ok, ...bad }).map(iso => [iso, {
    ok: Object.fromEntries((ok[iso] || []).map(k => [k, 1])), bad: Object.fromEntries((bad[iso] || []).map(k => [k, 1])) }]));
  writePlanLog({ v: 1, days });
}, { goal: GOAL, start: START, ok, bad });
const todayTasks = pg => pg.evaluate(iso => planLoad().days.find(d => d.date === iso).tasks, TODAY);

async function checkHome(pg, tag) {
  await pg.evaluate(() => { byId('installBanner').classList.add('visible'); goHome(); });
  await checkControls(pg, `${tag} Home`, [
    ['[data-action="resetPracticeProgress"]', 'lead', ['reset']],
    ['[data-action="resetCompletedExams"]', 'lead', ['reset']],
    ['.install-close', 'only', ['close']],
    ['#planHomeCard .plan-cta-go, .plan-cta .plan-cta-go', 'trail', ['arrowRight']],
  ]);
  await pg.evaluate(() => byId('installBanner').classList.remove('visible'));
}

async function checkQuiz(pg, tag) {
  await pg.evaluate(() => { goHome(); pendingMode = 'practice'; startExam(1); });
  await checkControls(pg, `${tag} Practice Q1`, [['#prevBtn', 'lead', ['arrowLeft']], ['#nextBtn', 'trail', ['arrowRight']]]);
  // a question with similar questions: its panel's "Practise these N"
  await pg.evaluate(() => {
    const i = state.questions.findIndex(q => similarKeys(q).length > 0);
    state.current = i;
    state.answers[i] = [...state.questions[i].a];
    revealAnswer();
  });
  await checkControls(pg, `${tag} Practice similar`, [['.sqm-cta button', 'lead', ['play']]]);
  await pg.evaluate(() => { state.current = state.questions.length - 1; renderQuestion(); });
  await checkControls(pg, `${tag} Practice last`, [['#nextBtn', 'trail', ['check']]]);
  await pg.evaluate(() => { goHome(); pendingMode = 'exam'; startExam(1); state.current = state.questions.length - 1; renderQuestion(); });
  await checkControls(pg, `${tag} Exam last`, [['#prevBtn', 'lead', ['arrowLeft']]]);
  await pg.evaluate(() => { goHome(); startFactPractice(21); state.current = state.questions.length - 1; renderQuestion(); });
  await checkControls(pg, `${tag} side session last`, [['#nextBtn', 'lead', ['returnLeft']]]);
  await pg.evaluate(() => goHome());
}

async function checkStudy(pg, tag) {
  await pg.evaluate(() => { openStudy(); study.tab = 'chapters'; study.chapter = 3; renderStudy(); });
  await checkControls(pg, `${tag} Study`, [
    ['#studyContent .fact-practise', 'lead', ['play']],
    ['#studyContent .fact-btn.tick', 'only', ['check']],
    ['[data-action="studyToggle"][data-arg="hideMastered"]', 'lead', ['check']],
  ]);
  await pg.evaluate(() => {
    const f = {};
    for (let i = 0; i < 3; i++) f[`1.${i}`] = true;
    localStorage.setItem('lifeuk.practiceFlags', JSON.stringify(f));
    practiceFlags = f;
    openFlagged();
  });
  await checkControls(pg, `${tag} Flagged`, [['#flaggedStart .go', 'icon', ['arrowRight']]]);
}

async function checkMemo(pg, tag) {
  await pg.evaluate(() => {
    localStorage.setItem('lifeuk.memoProgress', JSON.stringify({ vote: { lv: 1, due: planTodayIso() } }));
    openStudy(); study.tab = 'memo'; renderStudy();
  });
  await checkControls(pg, `${tag} Memo list`, [['#studyContent .memo-due-start', 'trail', ['play']]]);
  await pg.evaluate(() => openMemoGroup('vote'));
  await checkControls(pg, `${tag} Memo look`, [['#screenMemo .memo-back', 'lead', ['chevronLeft']], ['#memoBody .memo-start', 'trail', ['play']]]);
  await pg.evaluate(() => startMemoTest());
  await checkControls(pg, `${tag} Memo test`, [['#screenQuiz .back-btn', 'lead', ['chevronLeft']]]);
  await pg.evaluate(() => {
    state.questions.forEach((q, i) => { state.answers[i] = [...q.a]; state.revealed[i] = true; });
    state.current = state.questions.length - 1;
    runNextAction();
  });
  await checkControls(pg, `${tag} Memo result`, [['#memoBody .memo-next', 'trail', ['play']]]);
}

async function checkPlanScreens(pg, tag) {
  await pg.evaluate(() => { localStorage.removeItem('lifeuk.studyPlan'); openPlanGoal(); });
  await checkControls(pg, `${tag} Plan goal`, [['#planCreateBtn', 'trail', ['arrowRight']]]);
  await seedPlan(pg);
  await pg.evaluate(() => openPlanGoal(planLoad().goal));
  await checkControls(pg, `${tag} Plan goal (edit)`, [['#planCreateBtn', 'trail', ['arrowRight']]]);
  await pg.evaluate(() => goHome());
  await checkControls(pg, `${tag} Home plan card`, [['#screenHome [data-action="planContinue"]', 'trail', ['arrowRight']]]);
  await pg.evaluate(() => openPlanSchedule());
  await checkControls(pg, `${tag} Plan schedule`, [
    ['[data-action="planAskReset"]', 'lead', ['reset']],
    ['#screenPlanSchedule .plan-block[data-action="openPlanDay"]', 'trail', ['arrowRight']],
  ]);
  const tasks = await todayTasks(pg);
  const p = tasks.findIndex(t => t.type === 'practice');
  await seedPlan(pg, { ok: { [TODAY]: tasks[p].qids } });
  await pg.evaluate(iso => openPlanDay(iso), START);
  await checkControls(pg, `${tag} Plan day`, [
    ['#planDayPrev', 'only', ['chevronLeft']], ['#planDayNext', 'only', ['chevronRight']],
    ['#planCalPrev', 'only', ['chevronLeft']], ['#planCalNext', 'only', ['chevronRight']],
    ['#planBackToday', 'lead', ['arrowLeft']],
    ['#planTaskList .plan-task-btn:not(.done) .plan-task-go', 'trail', ['chevronRight']],
  ]);
  await pg.evaluate(() => openPlanDay());
  await checkControls(pg, `${tag} Plan day (today)`, [['#planTaskList .plan-task-btn.done .plan-task-go', 'both', ['check', 'chevronRight']]]);
}

async function checkPlanRun(pg, tag) {
  const tasks = await todayTasks(pg);
  const p = tasks.findIndex(t => t.type === 'practice'), r = tasks.findIndex(t => t.type === 'read');
  const [wrongKey, ...rest] = tasks[p].qids;
  await seedPlan(pg, { ok: { [TODAY]: rest }, bad: { [TODAY]: [wrongKey] } });
  // the one wrong answer left: answered wrong again → "Redo the wrong answer (1 left)"
  await pg.evaluate(({ iso, i }) => {
    planOpenTask(iso, i);
    const q = state.questions[state.current];
    state.answers[state.current] = q.o.map((_, k) => k).filter(k => !q.a.includes(k)).slice(0, q.a.length);
    revealAnswer();
  }, { iso: TODAY, i: p });
  await checkControls(pg, `${tag} Plan run`, [['#screenQuiz .back-btn', 'lead', ['arrowLeft']], ['#nextBtn', 'lead', ['redo']]]);
  await seedPlan(pg, { ok: { [TODAY]: tasks[p].qids } });
  await pg.evaluate(({ iso, i }) => planShowTaskDone(iso, i, null), { iso: TODAY, i: p });
  await checkControls(pg, `${tag} Plan task done`, [['#planRunBack', 'lead', ['arrowLeft']]]);
  await seedPlan(pg);
  await pg.evaluate(({ iso, i }) => planShowFacts({ date: iso, taskIndex: i, from: null }, 1, false), { iso: TODAY, i: r });
  await checkControls(pg, `${tag} Plan facts`, [
    ['#planRunBody [data-action="planStepFact"][data-arg="-1"]', 'lead', ['arrowLeft']],
    ['#planRunBody [data-action="planStepFact"][data-arg="1"]', 'trail', ['arrowRight']],
    ['#planRunBody .fact-practise', 'lead', ['play']],
  ]);
  await pg.evaluate(() => { planRunView.pos = planRunContext(planRunView.date, planRunView.taskIndex).task.facts.length - 1; renderPlanRun(); });
  await checkControls(pg, `${tag} Plan facts last`, [['#planRunBody .plan-run-nav .nav-btn:last-child', 'trail', ['arrowRight']]]);
  await seedPlan(pg, { ok: { [TODAY]: tasks[p].qids } });
  await pg.evaluate(({ iso, i }) => planShowTaskDone(iso, i, null), { iso: TODAY, i: r });
  await checkControls(pg, `${tag} Plan task done (next)`, [['#planRunBody [data-action="planOpenTask"]', 'trail', ['arrowRight']]]);
}

(async () => {
  const browser = await chromium.launch(launchOpts);
  for (const w of WIDTHS) {
    const pg = await browser.newPage({ viewport: { width: w, height: 800 } });
    const errors = [];
    pg.on('pageerror', e => errors.push(e.message));
    for (const lang of LANGS) {
      for (const size of SIZES) {
        const tag = `${w}px ${lang} ${size}`;
        await fresh(pg, lang, size);
        await checkHome(pg, tag);
        await checkQuiz(pg, tag);
        await checkStudy(pg, tag);
        await checkMemo(pg, tag);
        await checkPlanScreens(pg, tag);
        await checkPlanRun(pg, tag);
      }
    }
    assert(!errors.length, `${w}px: no page errors: ` + errors.join(' | '));
    await pg.close();
  }
  await browser.close();
  console.log('PASS');
})().catch(e => { console.error(e.message); process.exit(1); });
