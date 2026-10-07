const { chromium } = require('playwright-core');
const path = require('path');
// v0.63 (P3 T-204 / T-205): a Study fact is mastered when it is ticked by hand (study.mastered[id]) OR every
// one of its source questions is 🏆 in Practice (factMastery(f).derived). The derived value is computed on render,
// never stored. Derived: the ✓ becomes a 🏆 that cannot be pressed (aria-disabled, no data-action), the card dims
// like a manual tick (Q7), Hide mastered hides both; Study header "🏆 n / 236 mastered" (O7).
const APP_URL = process.env.APP_URL || 'file://' + path.resolve(__dirname, '..', 'index.html');
const launchOpts = { args: ['--no-sandbox'] };
if (process.env.CHROMIUM_PATH) launchOpts.executablePath = process.env.CHROMIUM_PATH;
const assert = (c, m) => { if (!c) throw new Error('FAIL: ' + m); console.log('ok:', m); };

const DERIVED_FACT = 3;   // chapter 2, sources 4.6 / 6.5 / 17.8 — all mastered below
const PARTIAL_FACT = 21;  // chapter 3, 8 sources — one mastered below
const MANUAL_FACT = 4;    // chapter 2, ticked by hand
const CHAPTER = 2;
const STREAKS = { '4.6': 3, '6.5': 3, '17.8': 3, '4.16': 3 };
const STUDY_TOTAL = 236;

const card = id => `#studyContent .fact[data-fact-id="${id}"]`;

async function checkDomain(pg) {
  const m = await pg.evaluate(([d, p]) => {
    const pick = id => { const r = factMastery(STUDY.find(f => f.id === id)); return { mastered: r.mastered, total: r.total, derived: r.derived }; };
    return { d: pick(d), p: pick(p) };
  }, [DERIVED_FACT, PARTIAL_FACT]);
  assert(JSON.stringify(m.d) === '{"mastered":3,"total":3,"derived":true}', 'factMastery: every source 🏆 → derived (' + JSON.stringify(m.d) + ')');
  assert(JSON.stringify(m.p) === '{"mastered":1,"total":8,"derived":false}', 'factMastery: 1 / 8 sources → not derived (' + JSON.stringify(m.p) + ')');
  // W-011: zero sources is 0 / 0, not "every source mastered" — a fact with no source questions is never derived
  const empty = await pg.evaluate(() => factMastery({ src: [] }));
  assert(empty.derived === false && empty.total === 0, 'factMastery: no sources → not derived (' + JSON.stringify(empty) + ')');
}

async function checkDerivedCard(pg) {
  const c = await pg.$eval(card(DERIVED_FACT), e => {
    const btn = e.querySelector('.fact-btn.trophy');
    return {
      dimmed: e.classList.contains('mastered'), opacity: getComputedStyle(e).opacity,
      trophy: !!btn, text: btn?.textContent, ariaDisabled: btn?.getAttribute('aria-disabled'), action: btn?.hasAttribute('data-action'),
      title: btn?.title, plainTick: !!e.querySelector('.fact-btn.tick:not(.trophy)'),
    };
  });
  assert(c.dimmed && c.trophy && c.text === '🏆' && !c.plainTick, 'derived: card .mastered, ✓ replaced by 🏆 (' + JSON.stringify(c) + ')');
  assert(c.ariaDisabled === 'true' && c.action === false, '🏆 is aria-disabled and has no data-action');
  assert(c.title.startsWith('🏆 Mastered'), 'tooltip follows the glossary "🏆 Mastered" (O4): ' + c.title);
  await pg.click(`${card(DERIVED_FACT)} .fact-btn.trophy`, { force: true }); // aria-disabled: Playwright would wait
  assert(await pg.evaluate(() => localStorage.getItem('lifeuk.studyMastered')) === null, 'pressing 🏆 does nothing; derived value never stored');
  return c.opacity;
}

async function checkManualCard(pg, derivedOpacity) {
  await pg.click(`${card(MANUAL_FACT)} .fact-btn.tick`);
  const c = await pg.$eval(card(MANUAL_FACT), e => ({ dimmed: e.classList.contains('mastered'), opacity: getComputedStyle(e).opacity }));
  assert(c.dimmed && c.opacity === derivedOpacity, `manual tick dims the same as derived (Q7: ${c.opacity} / ${derivedOpacity})`);
  const partial = await pg.evaluate(id => { studySetChapter(3); return document.querySelector(`#studyContent .fact[data-fact-id="${id}"]`).classList.contains('mastered'); }, PARTIAL_FACT);
  assert(!partial, 'partly mastered sources: card not mastered');
  await pg.evaluate(ch => studySetChapter(ch), CHAPTER);
}

async function checkProgressAndHide(pg) {
  assert(await pg.$eval('#studyProgress', e => e.textContent) === `🏆 2 / ${STUDY_TOTAL} mastered`, 'header: 🏆 2 / 236 mastered (1 derived + 1 ticked, O7)');
  const total = parseInt((await pg.$eval('#studyCount', e => e.textContent)).split('/')[1]);
  await pg.click('text=Hide mastered');
  const shown = await pg.$eval('#studyCount', e => e.textContent);
  assert(shown === `${total - 2} / ${total} facts`, 'Hide mastered hides derived + ticked facts: ' + shown);
  await pg.click('text=Hide mastered');
}

// Home "Reset practice progress" keeps Study ticks (decided) but the derived 🏆 goes with the streaks
async function checkReset(pg) {
  await pg.evaluate(() => { streaks = {}; renderStudy(); });
  const r = await pg.evaluate(([d, m]) => ({
    derived: document.querySelector(`#studyContent .fact[data-fact-id="${d}"]`).classList.contains('mastered'),
    manual: document.querySelector(`#studyContent .fact[data-fact-id="${m}"]`).classList.contains('mastered'),
    progress: byId('studyProgress').textContent,
  }), [DERIVED_FACT, MANUAL_FACT]);
  assert(!r.derived && r.manual && r.progress === `🏆 1 / ${STUDY_TOTAL} mastered`, 'streaks cleared: derived 🏆 gone, manual tick kept: ' + JSON.stringify(r));
}

(async () => {
  const b = await chromium.launch(launchOpts);
  const pg = await b.newPage({ viewport: { width: 390, height: 844 } });
  const errs = [];
  pg.on('pageerror', e => errs.push(e.message));
  await pg.goto(APP_URL);
  await pg.evaluate(s => { localStorage.clear(); localStorage.setItem('lifeuk.practiceStreak', JSON.stringify(s)); }, STREAKS);
  await pg.reload();
  await checkDomain(pg);
  await pg.evaluate(ch => { openStudy(); studySetTab('chapters'); studySetChapter(ch); }, CHAPTER);
  const derivedOpacity = await checkDerivedCard(pg);
  await checkManualCard(pg, derivedOpacity);
  await checkProgressAndHide(pg);
  await checkReset(pg);
  assert(errs.length === 0, 'no page errors' + (errs.length ? ': ' + errs.join('; ') : ''));
  await b.close();
  console.log('FACTMASTERY PASS');
})().catch(e => { console.error(e.message); process.exit(1); });
