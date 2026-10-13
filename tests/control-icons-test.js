const { chromium } = require('playwright-core');
const path = require('path');
// v1.6.1 (user 2026-10-12: "controls use line icons, never glyphs / emoji"): every button that used a glyph as its icon
// (← → ↩ ✓ ▶ 🔁 ↺ ✕ ‹ ›) now carries an SVG line icon (js/components/icons.js lineIconSvg, svg.line-icon, aria-hidden)
// and plain words; the icon sits where the glyph was (leading / trailing), icon-only buttons are named by aria-label +
// title. Walks Home, Quiz (Practice / Exam / side session / plan task / memo test), Study, Flagged, Memo, Plan goal /
// schedule / day / runner at 320 / 360 / 390px × en / zh-HK × small / large text:
// - no button (or role=button) text holds one of the glyphs; status / content inside a control is not a control icon
//   (STATUS_PARTS: day pills, task type emoji (📖 📝 🔁 🎯, like the group / tab emoji), task status line, memo badge), see HANDOFF › 已知限制
// - each control in scope has its icon (data-icon-name) at the expected end, the icon centred on the label line,
//   nothing overflowing the button and no sideways page scroll
const APP_URL = process.env.APP_URL || 'file://' + path.resolve(__dirname, '..', 'index.html');
const launchOpts = { args: ['--no-sandbox'] };
if (process.env.CHROMIUM_PATH) launchOpts.executablePath = process.env.CHROMIUM_PATH;
const assert = (c, m) => { if (!c) throw new Error('FAIL: ' + m); console.log('ok:', m); };

// CUI-0035 (user 2026-10-12: convert): the header ⓘ and the fact card memory note's ▸ / ▾ too
// CUI-0037 (user 2026-10-13: convert): the Home "Wrong answers" review tile's ✗
const GLYPHS = '←→↩✓▶🔁↺✕‹›ⓘ▸▾✗';
const STATUS_PARTS = '.plan-pill, .plan-task-ic, .plan-day-ic, .plan-task-st, .memo-badge';
const WIDTHS = [320, 360, 390];
const LANGS = ['en', 'zh-HK'];
const SIZES = ['small', 'large'];
const TODAY = '2026-10-01';
const START = '2026-09-28'; // Day 4 = TODAY (plan-run-test): reading + practice tasks, Days 1–3 carried over
const GOAL = { examDate: '2026-10-29', dailyMins: 120, restDays: [0], level: 'none' };
const CENTRE_TOL_PX = 2.5;
// v2.0.4 merge (main v2.0.0 desktop, ≥ 1024px): the same walk in the desktop layout, plus its own controls (the F7 plan
// card's Continue, the Plan Schedule ‹ › column scrollers, the exam rail's Submit)
const DESKTOP_CASES = [[{ width: 1280, height: 800 }, 'en', 'small'], [{ width: 1024, height: 768 }, 'zh-HK', 'large']];

// every button / role=button / summary in the document (hidden screens included): its text without status parts, and
// its ::before / ::after generated content (CUI-0035: the memory note's ▸ / ▾ came from summary::before)
const glyphButtons = pg => pg.evaluate(({ glyphs, status }) => [...document.querySelectorAll('button, [role="button"], summary')].map(b => {
  const c = b.cloneNode(true);
  c.querySelectorAll(status).forEach(s => s.remove());
  const generated = ['::before', '::after'].map(p => getComputedStyle(b, p).content).filter(v => v && v !== 'none' && v !== 'normal').join(' ');
  return { id: b.id || b.className || b.dataset.action || b.tagName, text: `${c.textContent.replace(/\s+/g, ' ').trim()} ${generated}` };
}).filter(b => [...glyphs].some(g => b.text.includes(g))), { glyphs: GLYPHS, status: STATUS_PARTS });

// one control: its icons (names, in order), where they sit and the layout
const controlInfo = (pg, sel) => pg.evaluate(sel => {
  const b = document.querySelector(sel);
  if (!b) return null;
  const icons = [...b.querySelectorAll('svg.line-icon')];
  const shown = b.getClientRects().length > 0;
  const kids = [...b.children].filter(k => !shown || k.getClientRects().length);
  const label = kids.find(k => k.tagName !== 'svg');
  const mid = r => (r.top + r.bottom) / 2;
  const br = b.getBoundingClientRect(), lr = label && label.getBoundingClientRect();
  return {
    shown, text: b.textContent.replace(/\s+/g, ' ').trim(), names: icons.map(i => i.dataset.iconName),
    hidden: icons.every(i => i.getAttribute('aria-hidden') === 'true'),
    lead: !!kids[0] && kids[0].tagName === 'svg', trail: kids.length > 1 && kids[kids.length - 1].tagName === 'svg',
    label: b.getAttribute('aria-label'), title: b.getAttribute('title'),
    centred: !shown || !lr || icons.every(i => Math.abs(mid(i.getBoundingClientRect()) - mid(lr)) <= 2.5),
    // every part inside the button's box (its ::before tap ring may reach past it), the words not cut
    fits: !shown || kids.every(k => { const r = k.getBoundingClientRect(); return r.left >= br.left - 0.5 && r.right <= br.right + 0.5; })
      && (!label || label.scrollWidth <= label.clientWidth + 1 || getComputedStyle(label).display === 'inline'), inside: !shown || br.right <= innerWidth + 0.5,
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
  await checkReviewTiles(pg, tag);
}

// CUI-0037: Practice → "My review" with wrong answers AND flags seeded, so both tiles show (with none the section stays
// hidden: the v1.6.1 walk never saw the wrong tile's ✗). Each tile's mark is an SVG, no glyph text: the wrong tile a
// line icon (cross, aria-hidden) in the red token, at the flagged bookmark's size, centred in its box
const REVIEW_TILE_WRONG = ['1.0', '1.1', '2.3'];
const REVIEW_TILE_FLAGS = ['3.0'];
async function checkReviewTiles(pg, tag) {
  await pg.evaluate(({ wrong, flags }) => {
    wrongList = Object.fromEntries(wrong.map(k => [k, true]));
    practiceFlags = Object.fromEntries(flags.map(k => [k, true]));
    goHome(); pendingMode = 'practice'; renderModeSelection();
  }, { wrong: REVIEW_TILE_WRONG, flags: REVIEW_TILE_FLAGS });
  const tiles = await pg.evaluate(() => ['#tileWrong', '#tileFlagged'].map(sel => {
    const tile = document.querySelector(sel), box = tile.querySelector('.t-icon'), svg = box.querySelector('svg');
    const br = box.getBoundingClientRect(), sr = svg && svg.getBoundingClientRect();
    const red = getComputedStyle(document.documentElement).getPropertyValue('--red-light').trim();
    const probe = document.createElement('i');
    probe.style.color = red;
    document.body.appendChild(probe);
    const redRgb = getComputedStyle(probe).color;
    probe.remove();
    return {
      sel, shown: byId('myReview').classList.contains('show') && tile.getClientRects().length > 0 && !tile.disabled,
      text: box.textContent.trim(), line: svg && svg.matches('svg.line-icon') ? svg.dataset.iconName : null,
      hidden: !!svg && svg.getAttribute('aria-hidden') === 'true', px: sr ? Math.round(sr.height) : 0,
      centred: !!sr && Math.abs((sr.top + sr.bottom) / 2 - (br.top + br.bottom) / 2) <= 1 && Math.abs((sr.left + sr.right) / 2 - (br.left + br.right) / 2) <= 1,
      stroke: svg ? getComputedStyle(svg).stroke : '', red: redRgb,
      fits: tile.getBoundingClientRect().right <= innerWidth + 0.5,
    };
  }));
  const [wrong, flag] = tiles;
  assert(tiles.every(x => x.shown && x.text === '' && x.px > 0 && x.centred && x.fits),
    `${tag} My review: both tiles shown, their marks are SVG (no glyph text), centred: ` + JSON.stringify(tiles));
  assert(wrong.line === 'cross' && wrong.hidden && wrong.stroke === wrong.red && wrong.px === flag.px,
    `${tag} My review: wrong tile mark = line icon cross, red token, bookmark size: ` + JSON.stringify(wrong));
  // the glyph scan over every button (both tiles included) and no sideways scroll with the tiles shown
  await checkControls(pg, `${tag} My review`, []);
  await pg.evaluate(() => { wrongList = {}; practiceFlags = {}; renderMyReview(); });
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
    // CUI-0035: the header ⓘ (named by aria-label) and the memory note's expander chevron
    ['#infoBtn', 'icon', ['info']],
    ['#studyContent .fact-mem summary', 'lead', ['chevronRight']],
  ]);
  // open, the chevron turns down (one icon, rotated); the summary keeps its words as its name
  const mem = await pg.evaluate(() => {
    const d = document.querySelector('#studyContent .fact-mem');
    const turn = () => getComputedStyle(d.querySelector('summary svg.line-icon')).transform;
    const closed = turn();
    d.open = true;
    const open = turn();
    d.open = false;
    return { closed, open, name: d.querySelector('summary').textContent.trim(), info: byId('infoBtn').getAttribute('aria-label') };
  });
  assert(mem.closed === 'none' && mem.open !== 'none' && mem.name.length > 0 && !!mem.info,
    `${tag} memory note chevron turns when open, names unchanged: ` + JSON.stringify(mem));
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
  // v2.1.1 (S-260, one back arrow): the plan header's back leads with the same chevron as "‹ Memory"
  await checkControls(pg, `${tag} Plan run`, [['#screenQuiz .back-btn', 'lead', ['chevronLeft']], ['#nextBtn', 'lead', ['redo']]]);
  await seedPlan(pg, { ok: { [TODAY]: tasks[p].qids } });
  await pg.evaluate(({ iso, i }) => planShowTaskDone(iso, i, null), { iso: TODAY, i: p });
  await checkControls(pg, `${tag} Plan task done`, [['#planRunBack', 'lead', ['chevronLeft']]]);
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

async function checkDesktopExtras(pg, tag) {
  await seedPlan(pg);
  await pg.evaluate(() => goHome());
  await checkControls(pg, `${tag} Home F7 plan card`, [['#screenHome .plan-home-acts [data-action="planContinue"]', 'trail', ['arrowRight']]]);
  await pg.evaluate(() => openPlanSchedule());
  await checkControls(pg, `${tag} Plan schedule scrollers`, [['.plan-hs-btn.l', 'icon', ['chevronLeft']], ['.plan-hs-btn.r', 'icon', ['chevronRight']]]);
  await pg.evaluate(() => { goHome(); pendingMode = 'exam'; startExam(1); goToQuestion(state.questions.length - 1); });
  const submit = await controlInfo(pg, '.exam-rail .exam-submit');
  assert(submit && submit.shown && submit.text.length > 0 && submit.names.length === 0, `${tag} Exam rail Submit: words only, shown on the last question ${JSON.stringify(submit)}`);
  await pg.evaluate(() => goToQuestion(0));
  assert(await pg.evaluate(() => document.querySelector('.exam-rail .exam-submit').getClientRects().length === 0), `${tag} Exam rail Submit hidden before the last question`);
}

(async () => {
  const browser = await chromium.launch(launchOpts);
  for (const [viewport, lang, size] of DESKTOP_CASES) {
    const pg = await browser.newPage({ viewport });
    const errors = [];
    pg.on('pageerror', e => errors.push(e.message));
    const tag = `desktop ${viewport.width}x${viewport.height} ${lang} ${size}`;
    await fresh(pg, lang, size);
    await checkHome(pg, tag);
    await checkQuiz(pg, tag);
    await checkStudy(pg, tag);
    await checkMemo(pg, tag);
    await checkPlanScreens(pg, tag);
    await checkPlanRun(pg, tag);
    await checkDesktopExtras(pg, tag);
    assert(!errors.length, `${tag}: no page errors: ` + errors.join(' | '));
    await pg.close();
  }
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
