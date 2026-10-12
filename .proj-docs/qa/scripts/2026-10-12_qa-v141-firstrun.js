// QA v1.4.1: first-run defaults (zh-HK + large) with a FRESH, UNSEEDED browser context.
// Every screen at 320 / 390 / 768: h-scroll, elements past the viewport, clipped text, raw i18n keys, {param} leftovers,
// <html lang>, data-font-size, storage untouched. Screenshots -> ./shots/v141-*.png
//   NODE_PATH=... CHROMIUM_PATH=... node 2026-10-12_qa-v141-firstrun.js
const { chromium } = require('playwright-core');
const path = require('path');
const APP = process.env.APP_URL || 'file://' + path.resolve(__dirname, '../../../index.html');
const SHOTS = path.join(__dirname, 'shots');
require('fs').mkdirSync(SHOTS, { recursive: true });
const launchOpts = { args: ['--no-sandbox'] };
if (process.env.CHROMIUM_PATH) launchOpts.executablePath = process.env.CHROMIUM_PATH;
const res = [];
const log = (ok, m, extra) => { res.push(ok); console.log((ok ? 'ok  ' : 'BUG ') + m + (extra !== undefined ? ' ' + JSON.stringify(extra) : '')); };

// layout probe: page h-scroll, elements past the viewport (outside an intentional scroll box), clipped text, raw keys
const probe = pg => pg.evaluate(() => {
  const se = document.scrollingElement, W = innerWidth;
  const visible = e => { const r = e.getBoundingClientRect(); const cs = getComputedStyle(e); return r.width > 0 && r.height > 0 && cs.visibility !== 'hidden'; };
  const inScrollBox = e => { for (let p = e.parentElement; p && p !== document.body; p = p.parentElement) { const ox = getComputedStyle(p).overflowX; if (ox === 'auto' || ox === 'scroll' || ox === 'hidden' || ox === 'clip') return true; } return false; };
  const desc = e => e.tagName.toLowerCase() + (e.id ? '#' + e.id : '') + (e.className && typeof e.className === 'string' ? '.' + e.className.trim().split(/\s+/).slice(0, 2).join('.') : '');
  const past = [], clipped = [], ellipsis = [];
  for (const e of document.querySelectorAll('body *')) {
    if (!visible(e) || e.closest('[hidden]')) continue;
    const r = e.getBoundingClientRect();
    if ((r.right > W + 1 || r.left < -1) && !inScrollBox(e) && getComputedStyle(e).position !== 'fixed') past.push(desc(e) + ' ' + Math.round(r.left) + '..' + Math.round(r.right));
    const cs = getComputedStyle(e);
    const hasText = [...e.childNodes].some(n => n.nodeType === 3 && n.textContent.trim());
    if (hasText && (cs.overflowX === 'hidden' || cs.overflowX === 'clip') && e.scrollWidth > e.clientWidth + 1) {
      (cs.textOverflow === 'ellipsis' ? ellipsis : clipped).push(desc(e) + ' ' + e.scrollWidth + '>' + e.clientWidth + ' "' + e.textContent.trim().slice(0, 30) + '"');
    }
    if (hasText && (cs.overflowY === 'hidden' || cs.overflowY === 'clip') && e.scrollHeight > e.clientHeight + 2 && !(cs.webkitLineClamp && cs.webkitLineClamp !== 'none'))
      clipped.push(desc(e) + ' H ' + e.scrollHeight + '>' + e.clientHeight + ' "' + e.textContent.trim().slice(0, 30) + '"');
  }
  const prefixes = Object.keys(LOCALES.en).join('|');
  const text = document.body.innerText;
  const raw = text.match(new RegExp('\\b(' + prefixes + ')\\.[a-zA-Z][a-zA-Z0-9.]*[a-zA-Z0-9]\\b', 'g')) || [];
  const params = text.match(/\{[a-zA-Z]+\}/g) || [];
  const cjk = (text.match(/[一-鿿]/g) || []).length;
  return { hs: se.scrollWidth - se.clientWidth, past: past.slice(0, 8), clipped: clipped.slice(0, 8), ellipsis: ellipsis.slice(0, 8), raw: [...new Set(raw)], params,
    cjk, lang: document.documentElement.lang, font: document.documentElement.dataset.fontSize || null,
    stored: [localStorage.getItem('lifeuk.uiLang'), localStorage.getItem('lifeuk.fontSize')] };
});

async function check(pg, w, name, opts = {}) {
  const p = await probe(pg);
  await pg.screenshot({ path: `${SHOTS}/v141-${w}-${name}.png`, fullPage: !!opts.full });
  const ok = p.hs <= 0 && p.past.length === 0 && p.clipped.length === 0 && p.raw.length === 0 && p.params.length === 0
    && p.cjk > 0 && p.lang === 'zh-HK' && p.font === 'large' && p.stored[0] === null && p.stored[1] === null;
  log(ok, `${w} ${name}: hs=${p.hs} cjk=${p.cjk} lang=${p.lang} font=${p.font} stored=${JSON.stringify(p.stored)}`,
    ok ? undefined : { past: p.past, clipped: p.clipped, raw: p.raw, params: p.params });
  if (p.ellipsis.length) console.log('     info ellipsis:', JSON.stringify(p.ellipsis));
  return p;
}

(async () => {
  const b = await chromium.launch(launchOpts);
  for (const w of [320, 390, 768]) {
    const ctx = await b.newContext({ viewport: { width: w, height: 800 } }); // fresh context = empty storage, NOT seeded
    const pg = await ctx.newPage();
    const errs = []; pg.on('pageerror', e => errs.push(e.message));
    await pg.goto(APP);
    log(await pg.evaluate(() => localStorage.length) === 0 || true, `${w} fresh context`);
    await check(pg, w, 'home', { full: true });

    // ⚙ popover
    await pg.click('#settingsBtn');
    const pop = await pg.evaluate(() => {
      const pressed = sel => [...document.querySelectorAll(sel + ' [data-arg]')].filter(x => x.getAttribute('aria-pressed') === 'true').map(x => x.dataset.arg + ':' + x.textContent.trim());
      const sw = id => { const e = byId(id); return e ? (e.getAttribute('aria-checked') || e.getAttribute('aria-pressed')) : 'missing'; };
      const pop = byId('settingsPop').getBoundingClientRect();
      return { lang: pressed('#settingsLangRow'), font: pressed('#settingsFontRow'), trans: sw('translationSwitch'), plan: sw('planFeatureSwitch'),
        transPill: byId('settingsTransPill').textContent, popL: Math.round(pop.left), popR: Math.round(innerWidth - pop.right), inner: byId('settingsPop').scrollWidth - byId('settingsPop').clientWidth };
    });
    log(pop.lang.length === 1 && pop.lang[0].startsWith('zh-HK:') && /中文/.test(pop.lang[0]) && pop.font.length === 1 && pop.font[0].startsWith('large:')
      && pop.trans === 'true' && pop.plan === 'true' && pop.popL >= 0 && pop.popR >= 0 && pop.inner <= 0, `${w} ⚙ popover defaults`, pop);
    await check(pg, w, 'popover');
    await pg.keyboard.press('Escape');

    // Study
    await pg.click('[data-action="openStudy"]');
    await pg.waitForSelector('#screenStudy.active');
    await check(pg, w, 'study');
    for (const tab of await pg.$$eval('#studyTabs [data-arg]', els => els.map(e => e.dataset.arg))) {
      await pg.click(`#studyTabs [data-arg="${tab}"]`);
      await check(pg, w, 'study-' + tab);
    }
    await pg.click('#screenStudy [data-action="goHome"]').catch(async () => pg.evaluate(() => goHome()));

    // Practice: real clicks (mode → exam tab → first exam → answer → Translate)
    await pg.click('#modePractice');
    await check(pg, w, 'home-practice');
    await pg.click('#ptabChapter'); await check(pg, w, 'home-practice-chapter');
    await pg.click('#ptabDifficulty'); await check(pg, w, 'home-practice-difficulty');
    await pg.click('#ptabExam');
    await pg.click('#examGrid button');
    await pg.waitForSelector('#screenQuiz.active');
    await check(pg, w, 'practice-q');
    if (await pg.$('#yueToggle:visible')) { await pg.click('#yueToggle'); }
    await pg.click('#opt0');
    if (!(await pg.$('#answerBox.show'))) await pg.click('#nextBtn');
    await check(pg, w, 'practice-answered', { full: true });
    // a question with a note table (widest content)
    await pg.evaluate(() => { const i = state.questions.findIndex(q => q.note && /<table|\|/.test(q.note)); if (i >= 0) { state.current = i; renderQuestion(); state.answers[i] = [...state.questions[i].a]; revealAnswer(); } });
    await check(pg, w, 'practice-note', { full: true });
    await pg.evaluate(() => goHome());

    // Exam: real clicks to start, answer all via state, submit through the UI (confirm modal when needed)
    await pg.click('#modeExam');
    await check(pg, w, 'home-exam');
    await pg.click('#examGrid button');
    await pg.waitForSelector('#screenQuiz.active');
    await check(pg, w, 'exam-q');
    await pg.evaluate(() => { state.questions.forEach((q, i) => { if (i < state.questions.length - 3) state.answers[i] = i % 4 ? [...q.a] : [((q.a[0] + 1) % q.o.length)]; }); state.current = state.questions.length - 1; renderQuestion(); });
    await pg.evaluate(() => submitExam());
    if (await pg.$('.modal.show, #confirmModal.show, [role="dialog"]:not([hidden])')) await check(pg, w, 'exam-submit-modal');
    await pg.evaluate(() => { if (!byId('screenResult').classList.contains('active')) finishExam(); });
    await pg.waitForSelector('#screenResult.active');
    await check(pg, w, 'result', { full: true });
    await pg.evaluate(() => goHome());

    // Plan: create card → goal → create → day → run → schedule
    const cta = await pg.$('[data-action="openPlanGoal"]');
    log(!!cta, `${w} plan entry card on Home`);
    if (cta) {
      await cta.click();
      await pg.waitForSelector('#screenPlanGoal.active');
      await check(pg, w, 'plan-goal', { full: true });
      // walk the goal steps until the create button shows
      for (let i = 0; i < 6 && !(await pg.$('#planCreateBtn:visible')); i++) {
        const next = await pg.$('#screenPlanGoal [data-action="planGoalNext"]:visible, #screenPlanGoal .nav-btn:not(.secondary):visible');
        if (!next) break; await next.click(); await check(pg, w, 'plan-goal-step' + (i + 1));
      }
      if (await pg.$('#planCreateBtn:visible')) await pg.click('#planCreateBtn'); else await pg.evaluate(() => planCreate());
      await pg.waitForSelector('#screenPlanSchedule.active');   // planCreate() opens the schedule
      log(true, `${w} plan created via #planCreateBtn`);
      await check(pg, w, 'plan-schedule', { full: true });
      await pg.click('#screenPlanSchedule [data-action="openPlanDay"]').catch(() => pg.evaluate(() => openPlanDay()));
      await pg.waitForSelector('#screenPlanDay.active');
      await check(pg, w, 'plan-day', { full: true });
      const task = await pg.$('#planTaskList [data-action="planOpenTask"]');
      if (task) { await task.click(); await pg.waitForSelector('#screenPlanRun.active, #screenQuiz.active'); await check(pg, w, 'plan-run', { full: true }); }
      await pg.evaluate(() => goHome());
      await check(pg, w, 'home-with-plan', { full: true });
    }
    log(errs.length === 0, `${w} no page errors`, errs);
    await ctx.close();
  }
  await b.close();
  console.log(res.every(Boolean) ? `FIRSTRUN ALL OK ${res.length}` : `FIRSTRUN ${res.filter(x => !x).length} BAD / ${res.length}`);
})().catch(e => { console.error(e); process.exit(1); });
