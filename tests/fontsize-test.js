const { chromium } = require('playwright-core');
const { seedLegacyDefaults, NO_SEED_SS } = require('./legacy-defaults'); // v1.4.2: keep the old en + small first run
const fs = require('fs');
const path = require('path');
// v1.3.0 (font size plan PR-C; mockup mockups/font-size-switch.html, grill .proj-docs/plans/2026-10-11_grill_font-size.md):
// - Q1 / Q2: two text sizes; small (the default until v1.4.2) is today's look, large is every --fs-* token + 2px, all text included
// - v1.4.2: large is the first-run default (user-approved); the rest of this suite seeds the old small (tests/legacy-defaults.js)
// - Q8 / Q10: ⚙ → "Text size" [ A | A ] (small A / large A, the current one pressed); a choice closes the popover and
//   focus goes back to ⚙; nothing is written until the user picks (lifeuk.fontSize), the choice survives a reload
// - Q3 / M2: large text keeps the layout: L4b (plan task card: "Start ›" under the text), L5 (study order count column
//   128px), v1.3.1 goal form rows fit their texts (replaces W-056 / C7), 320–400px en + zh-HK never scroll sideways on 13 screens (S-195)
// - C3: the quiz counter reads "Question 1 of 24" unless that wraps, then "Question 1/24" ("第 1/24 題"), then (v2.0.5
//   C3, user 2026-10-13) "Q 1/24" ("1/24 題"). v2.0.5 (方案 Y): "wraps" is the counter or its stars, in any state of
//   the question (Translate / "Hide" before answering, ← → after), so a question keeps one form throughout (qnum-row-test)
// - S-193: ⓘ has a 44px tap area
const APP_URL = process.env.APP_URL || 'file://' + path.resolve(__dirname, '..', 'index.html');
const launchOpts = { args: ['--no-sandbox'] };
if (process.env.CHROMIUM_PATH) launchOpts.executablePath = process.env.CHROMIUM_PATH;
const assert = (c, m) => { if (!c) throw new Error('FAIL: ' + m); console.log('ok:', m); };

const FONT_LS = 'lifeuk.fontSize';
const STEP_PX = 2; // Q1
const HIT_MIN_PX = 44;
const WIDTHS = [320, 360, 375, 390, 400];
const LANGS = ['en', 'zh-HK'];
const GOAL = { examDate: '2026-10-22', dailyMins: 120, restDays: [0], level: 'none' };
const NOW = new Date('2026-10-11T09:00:00');
const L5_COUNT_W_PX = 128;
const NO_SEED_TRIES = 3; // S-242
const REFIT_WAIT_MS = 2000; // S-242: a resize event can land later than two frames late in a long suite run

const fresh = async (pg, lang = 'en') => {
  await pg.goto(APP_URL);
  await pg.evaluate(ANSWER_FIRST_SINGLE);
  await pg.evaluate(() => localStorage.clear());
  await pg.goto(APP_URL);
  await pg.evaluate(ANSWER_FIRST_SINGLE);
  if (lang !== 'en') await pg.evaluate(l => setLang(l), lang);
};
const sizeOf = pg => pg.evaluate(() => document.documentElement.dataset.fontSize || 'small');
const stored = pg => pg.evaluate(k => localStorage.getItem(k), FONT_LS);
const popShown = pg => pg.$eval('#settingsPop', e => e.getClientRects().length > 0);
async function chooseSize(pg, size) {
  await pg.click('#settingsBtn');
  await pg.click(`#settingsFontRow [data-arg="${size}"]`);
}
// every --fs-* token defined in tokens.css (file:// pages cannot read cssRules), measured on the page as px numbers
const FS_TOKENS = [...new Set([...fs.readFileSync(path.resolve(__dirname, '..', 'css/base/tokens.css'), 'utf8')
  .replace(/\/\*[\s\S]*?\*\//g, '').matchAll(/(--fs-[\w-]+)\s*:/g)].map(m => m[1]))];
const tokens = pg => pg.evaluate(names => {
  const cs = getComputedStyle(document.documentElement);
  return Object.fromEntries(names.map(n => [n, parseFloat(cs.getPropertyValue(n))]));
}, FS_TOKENS);

// v1.4.2: default large (first run, nothing stored), the row, a choice, storage, reload, back to small. The real first
// run, so the legacy small seed is off here; the language stays en (only the text size default is under test)
// S-242: on file:// Chromium now and then navigates before the sessionStorage write commits, so the legacy seed ran and
// stored small text (2/60 runs). Check the flag survived the navigation; if not, write it again and reload.
async function gotoFirstRun(pg) {
  await pg.goto(APP_URL);
  for (let i = 0; i < NO_SEED_TRIES; i++) {
    await pg.evaluate(([ss, langKey]) => { sessionStorage.setItem(ss, '1'); localStorage.clear(); localStorage.setItem(langKey, JSON.stringify('en')); }, [NO_SEED_SS, 'lifeuk.uiLang']);
    await pg.goto(APP_URL);
    if (await pg.evaluate(ss => sessionStorage.getItem(ss) === '1', NO_SEED_SS)) return;
  }
  assert(false, `S-242: the no-seed flag survives the navigation (${NO_SEED_TRIES} tries)`);
}
async function checkSwitch(pg) {
  await gotoFirstRun(pg);
  assert(await sizeOf(pg) === 'large' && await stored(pg) === null, 'v1.4.2 default: large text, nothing stored');
  await pg.click('#settingsBtn');
  const row = await pg.evaluate(() => [...document.querySelectorAll('#settingsFontRow [data-arg]')].map(b => {
    const r = b.getBoundingClientRect();
    return { arg: b.dataset.arg, text: b.textContent, pressed: b.getAttribute('aria-pressed'), label: b.getAttribute('aria-label'), fs: parseFloat(getComputedStyle(b).fontSize), h: r.height };
  }));
  assert(row.length === 2 && row[0].arg === 'small' && row[1].arg === 'large' && row.every(o => o.text === 'A'), 'Q8: the text size row is [ A | A ]: ' + JSON.stringify(row));
  assert(row[0].pressed === 'false' && row[1].pressed === 'true' && row[0].fs < row[1].fs, 'Q8: large A pressed (default), the large A drawn bigger');
  assert(row[0].label === 'Small text' && row[1].label === 'Large text', 'each A is labelled for screen readers');
  await pg.click('#settingsFontRow [data-arg="small"]');
  assert(await sizeOf(pg) === 'small' && !(await pg.evaluate(() => document.documentElement.hasAttribute('data-font-size'))) && await stored(pg) === JSON.stringify('small'),
    'small: no attribute, small stored');
  assert(!(await popShown(pg)) && await pg.evaluate(() => document.activeElement.id) === 'settingsBtn', 'Q10: the choice closes the popover, focus back on ⚙');
  const small = await tokens(pg);
  assert(await pg.evaluate(() => parseFloat(getComputedStyle(document.body).fontSize)) === 16, 'small: body text 16px');
  await chooseSize(pg, 'large');
  assert(await sizeOf(pg) === 'large' && await stored(pg) === JSON.stringify('large'), 'large: <html data-font-size="large">, stored');
  const large = await tokens(pg);
  const off = Object.keys(small).filter(k => Math.abs(large[k] - small[k] - STEP_PX) > 0.01);
  assert(Object.keys(small).length >= 20 && off.length === 0, `Q1 / Q2: every --fs-* token is ${STEP_PX}px larger (${Object.keys(small).length} tokens): ` + off.join(', '));
  assert(await pg.evaluate(() => parseFloat(getComputedStyle(document.body).fontSize)) === 18, 'body text 16 → 18px');
  await pg.reload();
  assert(await sizeOf(pg) === 'large', 'reload: large text kept');
  await pg.click('#settingsBtn');
  assert(await pg.getAttribute('#settingsFontRow [data-arg="large"]', 'aria-pressed') === 'true', 'reload: large A pressed');
  await pg.keyboard.press('Escape');
  await chooseSize(pg, 'small');
  await pg.reload();
  assert(await sizeOf(pg) === 'small' && await stored(pg) === JSON.stringify('small'), 'reload: small text kept');
  await pg.evaluate(k => localStorage.setItem(k, '"huge"'), FONT_LS);
  await pg.reload();
  assert(await sizeOf(pg) === 'large', 'an unknown stored value reads as large (the v1.4.2 default)');
  await pg.evaluate(ss => sessionStorage.removeItem(ss), NO_SEED_SS);
}

// zh-HK labels; the language switch keeps the size
async function checkZh(pg) {
  await fresh(pg, 'zh-HK');
  await chooseSize(pg, 'large');
  const labels = await pg.evaluate(() => [byId('settingsFontLabel').textContent, ...[...document.querySelectorAll('#settingsFontRow [data-arg]')].map(b => b.getAttribute('aria-label'))]);
  assert(JSON.stringify(labels) === JSON.stringify(['字型大小', '細字', '大字']), 'zh-HK: 字型大小 / 細字 / 大字: ' + labels.join(' / '));
  await pg.evaluate(() => setLang('en'));
  assert(await sizeOf(pg) === 'large', 'switching the language keeps large text');
}

// question 1 is a single-answer question (swapped in), answered right: the row shows ← → instead of Translate
const ANSWER_FIRST_SINGLE = `window.answerFirstSingle = () => {
  pendingMode = 'practice'; startExam(1);
  const i = state.questions.findIndex(q => q.a.length === 1);
  [state.questions[0], state.questions[i]] = [state.questions[i], state.questions[0]];
  renderQuestion();
  const q = state.questions[0];
  selectOption(q.o.indexOf(q.a[0]));
}`;
// C3: the counter only turns short where the long one wraps
const counter = pg => pg.evaluate(() => {
  const s = document.querySelector('#qNum > span');
  const r = document.createRange();
  r.selectNodeContents(s);
  return { text: s.textContent, lines: new Set([...r.getClientRects()].map(x => Math.round(x.top))).size };
});
async function checkCounter(pg) {
  // v2.0.5 (方案 Y): the form is the one that fits before and after answering (Translate / "Hide" needs it before);
  // C3 (user 2026-10-13): a third tier "Q 1/24" (中文 "1/24 題") where even the short form would wrap
  const cases = [['en', 320, 'large', 'Q 1/24'], ['en', 390, 'large', 'Q 1/24'], ['en', 430, 'small', 'Question 1 of 24'],
    ['zh-HK', 320, 'large', '1/24 題'], ['zh-HK', 390, 'small', '第 1 題（共 24 題）']];
  for (const [lang, w, size, want] of cases) {
    await pg.setViewportSize({ width: w, height: 760 });
    await fresh(pg, lang);
    if (size === 'large') await chooseSize(pg, 'large');
    // answered (the mockup's state): the row has the small ← → buttons. A single-answer question goes first: a multi-answer
    // one needs its Check button before it reveals, so the wide Translate button stays (the C3b case)
    await pg.evaluate(() => { answerFirstSingle(); });
    const c = await counter(pg);
    assert(c.text === want && c.lines === 1, `C3 ${lang} ${w}px ${size}, answered: "${want}" on one line: ` + JSON.stringify(c));
  }
  // not yet answered, the wider "Translate" button is in the row: v2.0.5 C3, the tiny form on one line
  await pg.setViewportSize({ width: 320, height: 760 });
  await fresh(pg);
  await chooseSize(pg, 'large');
  await pg.evaluate(() => { pendingMode = 'practice'; startExam(1); });
  const unanswered = await counter(pg);
  assert(unanswered.text === 'Q 1/24' && unanswered.lines === 1, 'C3 en 320px large, not answered: the tiny form on one line: ' + JSON.stringify(unanswered));
  // the size switch and a resize re-measure it
  await pg.setViewportSize({ width: 430, height: 760 });
  await fresh(pg);
  await pg.evaluate(() => { answerFirstSingle(); });
  await chooseSize(pg, 'large');
  await pg.setViewportSize({ width: 320, height: 760 });
  await pg.waitForTimeout(100);
  assert((await counter(pg)).text === 'Q 1/24', 'C3: a resize to 320px re-measures → tiny');
  await chooseSize(pg, 'small');
  await pg.setViewportSize({ width: 430, height: 760 });
  await pg.waitForTimeout(100);
  assert((await counter(pg)).text === 'Question 1 of 24', 'C3: back to small text at 430px re-measures → long');
}

// L4b: in large text the plan task card puts "Start ›" under the text; L5: the order count column is 128px and fits
async function checkPlanLayout(pg) {
  await pg.setViewportSize({ width: 320, height: 760 });
  await fresh(pg);
  await chooseSize(pg, 'large');
  await pg.evaluate(goal => { writeStudyPlan(buildPlan(goal, '2026-10-01')); openPlanDay(); }, GOAL);
  const card = await pg.$eval('#planTaskList .plan-task-btn', e => {
    const body = e.querySelector('.plan-task-body').getBoundingClientRect(), go = e.querySelector('.plan-task-go').getBoundingClientRect(), ic = e.querySelector('.plan-task-ic').getBoundingClientRect();
    return { below: go.top >= body.bottom - 1, right: Math.abs(go.right - body.right) <= 1, ic: Math.round(ic.width) };
  });
  assert(card.below && card.right && card.ic === 32, 'L4b: "Start ›" under the text, right-aligned; icon 32px: ' + JSON.stringify(card));
  await pg.evaluate(() => openPlanSchedule());
  const order = await pg.$$eval('#planOrder .plan-chw-c', els => els.map(e => ({ w: Math.round(e.getBoundingClientRect().width), fits: e.scrollWidth <= e.clientWidth + 1 })));
  assert(order.length === 4 && order.every(o => o.w === 128 && o.fits), `L5: order count column ${128}px, every count fits: ` + JSON.stringify(order));
  await chooseSize(pg, 'small');
  await pg.evaluate(() => openPlanDay());
  const smallCard = await pg.$eval('#planTaskList .plan-task-btn', e => e.querySelector('.plan-task-go').getBoundingClientRect().top < e.querySelector('.plan-task-body').getBoundingClientRect().bottom);
  assert(smallCard, 'small text: "Start ›" stays beside the text (L4b is large only)');
}

// Q3: large text never scrolls sideways
async function checkNoSideScroll(pg) {
  const screens = {
    home: () => {}, study: () => openStudy(), quiz: () => { pendingMode = 'practice'; startExam(1); },
    result: () => { pendingMode = 'exam'; startExam(2); state.questions.forEach((q, i) => { state.answers[i] = [...q.a]; }); finishExam(); },
    planDay: goal => { writeStudyPlan(buildPlan(goal, '2026-10-01')); openPlanDay(); },
    planSchedule: goal => { writeStudyPlan(buildPlan(goal, '2026-10-01')); openPlanSchedule(); },
    // W-056 / S-195: the goal form and the screens the first test left out
    planGoal: () => openPlanGoal(),
    flagged: () => { pendingMode = 'practice'; startExam(5); setPracticeFlag(qKey(state.questions[0]), true); openFlagged(); },
    studyTimeline: () => { openStudy(); studySetTab('timeline'); },
    studyGeo: () => { openStudy(); studySetTab('geo'); },
    studyPeople: () => { openStudy(); studySetTab('people'); },
    settings: () => { goHome(); byId('settingsBtn').click(); },
  };
  for (const lang of LANGS) for (const w of WIDTHS) {
    await pg.setViewportSize({ width: w, height: 760 });
    await fresh(pg, lang);
    await chooseSize(pg, 'large');
    const bad = [];
    for (const [name, open] of Object.entries(screens)) {
      await pg.evaluate(`(${open})(${JSON.stringify(GOAL)})`);
      if (await pg.evaluate(() => document.documentElement.scrollWidth > innerWidth)) bad.push(name);
    }
    assert(bad.length === 0, `Q3 large ${lang} ${w}px: no sideways scroll: ` + bad.join(', '));
  }
}

// v1.3.1 (user; replaces W-056's / C7's wrap-when-it-does-not-fit): in either text size the goal form's rows follow
// what their texts need (js/components/fitRow.js). The 4 date presets keep the chip's own side padding and sit on one
// row unless a label would then wrap or be cut, else 2 × 2; the 3 level cards sit on one row unless a name or sub line
// would wrap, else one per row with the icon left of the text, the icons in one column and the texts on one left edge.
// Nothing is cut either way; every other duration tick is hidden at 359px and below in large text
const CHIP_PAD_PX = 12;
const ALIGN_TOL_PX = 1;
const fitState = (pg, box, texts) => pg.evaluate(({ box, texts }) => {
  const row = document.querySelector(box);
  const lines = el => { const h = el.getBoundingClientRect().height, ws = el.style.whiteSpace; el.style.whiteSpace = 'nowrap'; const one = el.getBoundingClientRect().height; el.style.whiteSpace = ws; return Math.max(1, Math.round(h / one)); };
  const bad = () => [...row.querySelectorAll(texts)].filter(e => lines(e) > 1 || e.scrollWidth > e.clientWidth + 1).length;
  const tops = sel => [...new Set([...row.querySelectorAll(sel)].map(e => Math.round(e.getBoundingClientRect().top)))];
  const stacked = row.classList.contains('is-stacked');
  const now = { bad: bad(), rows: tops(':scope > *').length };
  row.classList.remove('is-stacked');
  const oneRow = bad();
  row.classList.toggle('is-stacked', stacked);
  return { stacked, oneRow, ...now };
}, { box, texts });
const levelCardShape = pg => pg.evaluate(() => [...document.querySelectorAll('.plan-levels .mode-card')].map(card => {
  const r = el => card.querySelector(el).getBoundingClientRect();
  const icon = r('.mode-icon'), title = r('.mode-title'), sub = r('.plan-level-sub');
  return { iconX: Math.round((icon.left + icon.right) / 2), iconRight: icon.right, textLeft: Math.round(title.left), subLeft: Math.round(sub.left),
    iconMidY: (icon.top + icon.bottom) / 2, textTop: title.top, textBottom: sub.bottom };
}));
async function checkGoalPresets(pg, tag) {
  const r = await fitState(pg, '.plan-presets', '.chip');
  const pads = await pg.$$eval('.plan-presets .chip', cs => cs.map(c => parseFloat(getComputedStyle(c).paddingLeft)));
  assert(pads.every(p => p === CHIP_PAD_PX), `${tag} presets keep the chip's ${CHIP_PAD_PX}px side padding: ` + pads);
  assert(r.bad === 0 && (r.stacked ? r.oneRow > 0 && r.rows === 2 : r.rows === 1),
    `${tag} presets: one row while every label fits, else 2 × 2; nothing cut: ` + JSON.stringify(r));
}
async function checkGoalLevels(pg, tag) {
  const r = await fitState(pg, '.plan-levels', '.mode-title, .plan-level-sub');
  assert(r.bad === 0 && (r.stacked ? r.oneRow > 0 && r.rows === 3 : r.rows === 1),
    `${tag} levels: one row while every name and sub line fits, else one per row; nothing wraps: ` + JSON.stringify(r));
  if (!r.stacked) return;
  const cards = await levelCardShape(pg), tol = ALIGN_TOL_PX;
  const same = k => Math.max(...cards.map(c => c[k])) - Math.min(...cards.map(c => c[k])) <= tol;
  const beside = cards.every(c => c.iconRight <= c.textLeft && c.subLeft === c.textLeft && c.iconMidY > c.textTop && c.iconMidY < c.textBottom);
  assert(beside && same('iconX') && same('textLeft'), `${tag} stacked levels: icon left of the text, icons in one column, texts on one edge: ` + JSON.stringify(cards));
}
async function checkGoalLayout(pg) {
  for (const size of ['small', 'large']) for (const lang of LANGS) for (const w of [320, 375, 430, 600]) {
    await pg.setViewportSize({ width: w, height: 900 });
    await fresh(pg, lang);
    if (size === 'large') await chooseSize(pg, 'large');
    await pg.evaluate(() => openPlanGoal());
    const tag = `v1.3.1 ${size} ${lang} ${w}px`;
    await checkGoalPresets(pg, tag);
    await checkGoalLevels(pg, tag);
    if (size === 'large' && w === 600) {
      const one = await pg.evaluate(() => ['.plan-presets .chip', '.plan-levels .mode-card'].map(sel => new Set([...document.querySelectorAll(sel)].map(e => Math.round(e.getBoundingClientRect().top))).size));
      assert(one.every(n => n === 1), `${tag}: presets and level cards each on one row: ` + one);
    }
    if (size === 'small') continue;
    const ticks = await pg.evaluate(() => {
      const shown = [...document.querySelectorAll('.plan-ticks span')].filter(e => getComputedStyle(e).visibility !== 'hidden')
        .map(e => { const range = document.createRange(); range.selectNodeContents(e); return range.getBoundingClientRect(); });
      return { n: shown.length, touching: shown.some((a, i) => i > 0 && a.left < shown[i - 1].right + 2) };
    });
    assert(!ticks.touching && ticks.n === (w <= 359 ? 4 : 7), `W-056 ${lang} ${w}px large: duration ticks apart (${w <= 359 ? 4 : 7} shown): ` + JSON.stringify(ticks));
  }
}

// S-203: an open goal screen fits again on resize, a language switch and a text size switch (no reopen)
async function checkGoalRefit(pg) {
  const levels = () => pg.evaluate(() => byId('planLevelGrid').classList.contains('is-stacked'));
  // S-242: after a viewport resize, wait for fitRows (window resize event) to reach the expected state, not two rAFs
  const resized = async (width, stacked) => {
    await pg.setViewportSize({ width, height: 900 });
    await pg.waitForFunction(want => byId('planLevelGrid').classList.contains('is-stacked') === want, stacked, { timeout: REFIT_WAIT_MS }).catch(() => {});
  };
  await pg.setViewportSize({ width: 600, height: 900 });
  await fresh(pg, 'en');
  await pg.evaluate(() => openPlanGoal());
  assert(!(await levels()), 'S-203 small en 600px: level cards in one row');
  await resized(320, true);
  assert(await levels(), 'S-203 resize to 320px on the open screen: level cards stack');
  await resized(430, true);
  assert(await levels(), 'S-203 small en 430px: level cards still stacked');
  await pg.evaluate(() => setLang('zh-HK'));
  assert(!(await levels()), 'S-203 switch to zh-HK at 430px on the open screen: level cards back in one row');
  await chooseSize(pg, 'large');
  assert(!(await levels()), 'S-203 large zh-HK 430px on the open screen: still one row');
  await resized(375, true);
  assert(await levels(), 'S-203 large zh-HK 375px: level cards stack');
  await chooseSize(pg, 'small');
  assert(!(await levels()), 'S-203 switch to small text at 375px on the open screen: level cards back in one row');
}

// S-193: ⓘ keeps its 16px look; the tap area is 44px each way
async function checkInfoHit(pg) {
  await pg.setViewportSize({ width: 390, height: 760 });
  await fresh(pg);
  const hit = await pg.$eval('#infoBtn', (e, min) => {
    const r = e.getBoundingClientRect(), cx = r.left + r.width / 2, cy = r.top + r.height / 2, d = min / 2 - 1;
    const at = (x, y) => { const h = document.elementFromPoint(x, y); return !!h && (h === e || e.contains(h)); };
    return [at(cx - d, cy), at(cx + d, cy), at(cx, cy - d), at(cx, cy + d)];
  }, HIT_MIN_PX);
  assert(hit.every(Boolean), `S-193: ⓘ has a ${HIT_MIN_PX}px tap area: ` + JSON.stringify(hit));
}

(async () => {
  const b = seedLegacyDefaults(await chromium.launch(launchOpts));
  const pg = await b.newPage({ viewport: { width: 390, height: 844 } });
  await pg.clock.setFixedTime(NOW);
  const errs = []; pg.on('pageerror', e => errs.push(e.message));
  await checkSwitch(pg);
  await checkZh(pg);
  await checkCounter(pg);
  await checkPlanLayout(pg);
  await checkGoalLayout(pg);
  await checkGoalRefit(pg);
  await checkNoSideScroll(pg);
  await checkInfoHit(pg);
  assert(errs.length === 0, 'no page errors: ' + errs.join(' | '));
  await b.close();
  console.log('FONTSIZE PASS');
})().catch(e => { console.error(e.message); process.exit(1); });
