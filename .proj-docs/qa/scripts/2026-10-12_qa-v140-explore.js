const { chromium } = require('playwright-core');
const path = require('path');
const APP = process.env.APP_URL || 'file:///home/user/life-in-uk-test/index.html';
const SHOTS = path.join(__dirname, 'shots');
const res = []; const log = (ok, m, extra='') => { res.push({ ok, m }); console.log((ok ? 'ok  ' : 'BUG ') + m + (extra ? ' ' + JSON.stringify(extra) : '')); };
const vis = (pg, sel) => pg.$$eval(sel, els => els.filter(e => e.getClientRects().length > 0).length);
const hscroll = pg => pg.evaluate(() => {
  const se = document.scrollingElement; const pop = byId('settingsPop');
  return { page: se.scrollWidth - se.clientWidth, pop: pop && pop.getClientRects().length ? pop.scrollWidth - pop.clientWidth : 0,
    popRight: pop && pop.getClientRects().length ? Math.round(pop.getBoundingClientRect().right - innerWidth) : 0 };
});
const rawKeys = pg => pg.evaluate(() => (document.body.innerText.match(/\b(app|home|quiz|common|study|plan|exam)\.[a-zA-Z]+[A-Z][a-zA-Z]*\b/g) || []));
async function fresh(pg) { await pg.goto(APP); await pg.evaluate(() => localStorage.clear()); await pg.goto(APP); }

(async () => {
  const b = await chromium.launch({ args: ['--no-sandbox'] });
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 } });
  const pg = await ctx.newPage();
  const errs = []; pg.on('pageerror', e => errs.push(e.message)); pg.on('console', m => { if (m.type() === 'warning' || m.type() === 'error') errs.push('console:' + m.text()); });

  // ── AC1: default, row, keyboard toggle, persist ──
  await fresh(pg);
  await pg.screenshot({ path: `${SHOTS}/01-home-on-en.png`, fullPage: false });
  await pg.click('#settingsBtn');
  await pg.screenshot({ path: `${SHOTS}/02-popover-on-en-390.png` });
  const r1 = await pg.evaluate(() => ({ stored: localStorage.getItem('lifeuk.translation'), pill: byId('settingsTransPill').textContent, label: document.querySelector('#settingsTransRow b').textContent, note: byId('settingsTransStatus').textContent, order: [...document.querySelectorAll('#settingsFeatures .plan-setting-row')].map(e => e.id) }));
  log(r1.stored === null && r1.pill === 'On' && r1.label === '🈯 Translation', 'AC1 default ON, nothing stored, label+pill', r1);
  // keyboard: focus switch, Space
  await pg.focus('#translationSwitch'); await pg.keyboard.press('Space');
  const r2 = await pg.evaluate(() => ({ attr: document.documentElement.dataset.translation, stored: localStorage.getItem('lifeuk.translation'), popOpen: byId('settingsPop').getClientRects().length > 0, focus: document.activeElement.id }));
  log(r2.attr === 'off' && r2.stored === '"off"' && !r2.popOpen, 'AC1 keyboard Space toggles OFF + closes popover', r2);
  await pg.screenshot({ path: `${SHOTS}/03-home-off-en-desc.png` });
  const desc = await pg.$eval('#modeDesc', e => e.textContent);
  log(!/Cantonese/.test(desc), 'AC4 Home desc off: no Cantonese', desc);
  await pg.reload();
  log(await pg.evaluate(() => document.documentElement.dataset.translation) === 'off', 'AC1 persists across reload');
  // Enter key toggles back?
  await pg.click('#settingsBtn'); await pg.focus('#translationSwitch'); await pg.keyboard.press('Enter');
  log(await pg.evaluate(() => document.documentElement.dataset.translation) === undefined, 'AC1 keyboard Enter toggles back ON');
  // Escape closes popover without change
  await pg.click('#settingsBtn'); await pg.keyboard.press('Escape');
  log(await pg.evaluate(() => byId('settingsPop').getClientRects().length === 0 && localStorage.getItem('lifeuk.translation') === '"on"'), 'Esc closes popover without change');

  // ── AC2: real UI flow practice OFF ──
  await pg.click('#settingsBtn'); await pg.click('#translationSwitch');
  await pg.click('#modePractice');
  await pg.click('#ptabExam').catch(() => {});
  const examBtn = await pg.$('#examGrid button');
  await examBtn.click();
  await pg.waitForSelector('#screenQuiz.active');
  const q0 = { toggle: await vis(pg, '#yueToggle'), qYue: await vis(pg, '#qYue'), optYue: await vis(pg, '.opt-yue') };
  log(q0.toggle === 0 && q0.qYue === 0 && q0.optYue === 0, 'AC2 practice OFF before answer: no Translate / q / option yue', q0);
  await pg.screenshot({ path: `${SHOTS}/04-practice-off-before.png` });
  // keyboard shortcut for translation? try "t"
  await pg.keyboard.press('t'); 
  log(await vis(pg, '#qYue') === 0, 'AC2 OFF: pressing "t" key shows nothing');
  await pg.click('#opt0');
  // multi-answer may need submit; click check button if any
  const submit = await pg.$('#nextBtn'); 
  let revealed = await vis(pg, '#answerBox.show');
  if (!revealed) { await submit.click(); revealed = await vis(pg, '#answerBox.show'); }
  const q1 = { ansYue: await vis(pg, '#ansYue'), optYue: await vis(pg, '.opt-yue'), qYue: await vis(pg, '#qYue'), ansEn: await vis(pg, '#ansEn'), divider: await vis(pg, '#answerBox .divider'), note: await pg.$eval('#ansNote', e => e.innerHTML.length) };
  log(revealed && q1.ansYue === 0 && q1.optYue === 0 && q1.qYue === 0 && q1.ansEn === 1, 'AC2 practice OFF after answer: no yue', q1);
  await pg.screenshot({ path: `${SHOTS}/05-practice-off-answered.png`, fullPage: true });
  log((await hscroll(pg)).page <= 0, 'AC5 quiz 390 no h-scroll');

  // ── toggle mid-quiz: is ⚙ reachable on the quiz screen? state kept? ──
  const gearOnQuiz = await vis(pg, '#settingsBtn');
  log(true, 'INFO ⚙ visible on quiz screen: ' + gearOnQuiz);
  if (gearOnQuiz) {
    const before = await pg.evaluate(() => ({ cur: state.current, ans: JSON.stringify(state.answers) }));
    await pg.click('#settingsBtn'); await pg.click('#translationSwitch');
    const after = await pg.evaluate(() => ({ cur: state.current, ans: JSON.stringify(state.answers) }));
    const v = { ansYue: await vis(pg, '#ansYue'), box: await vis(pg, '#answerBox.show') };
    log(before.cur === after.cur && before.ans === after.ans && v.ansYue === 1 && v.box === 1, 'mid-quiz ON: answer kept, translation appears', v);
    await pg.click('#settingsBtn'); await pg.click('#translationSwitch');
  }

  // ── AC6 exam mode unaffected: compare visible text ON vs OFF ──
  const examSnap = async () => {
    await pg.goto(APP);
    await pg.click('#modeExam');
    await pg.click('#examGrid button');
    await pg.waitForSelector('#screenQuiz.active');
    const before = await pg.evaluate(() => ({ text: byId('screenQuiz').innerText, toggle: byId('yueToggle').getClientRects().length }));
    await pg.click('#opt0');
    const after = await pg.evaluate(() => byId('screenQuiz').innerText);
    return { before: before.text.replace(/\d+:\d+/g, ''), toggle: before.toggle, after: after.replace(/\d+:\d+/g, '') };
  };
  const exOff = await examSnap();
  await pg.evaluate(() => { localStorage.setItem('lifeuk.translation', '"on"'); });
  const exOn = await examSnap();
  log(exOff.before === exOn.before && exOff.after === exOn.after && exOff.toggle === 0 && exOn.toggle === 0, 'AC6 exam question screen identical ON vs OFF', { off: exOff.toggle, on: exOn.toggle, same: exOff.before === exOn.before });
  await pg.screenshot({ path: `${SHOTS}/06-exam-on.png` });

  // ── mid-exam toggle keeps timer & answers ──
  if (gearOnQuiz) {
    const st0 = await pg.evaluate(() => ({ ans: JSON.stringify(state.answers), cur: state.current, mode: state.mode }));
    await pg.click('#settingsBtn'); await pg.click('#translationSwitch');
    const st1 = await pg.evaluate(() => ({ ans: JSON.stringify(state.answers), cur: state.current, mode: state.mode, active: document.querySelector('.screen.active').id }));
    log(st0.ans === st1.ans && st0.cur === st1.cur && st1.active === 'screenQuiz', 'mid-exam toggle: exam state kept', st1);
  }

  // ── AC3 notes kept, no-note no divider (UI path through state helpers) ──
  await pg.evaluate(() => { localStorage.setItem('lifeuk.translation', '"off"'); }); await pg.goto(APP);
  await pg.evaluate(() => { pendingMode = 'practice'; startExam(1); state.current = state.questions.findIndex(q => q.note); renderQuestion(); const i = state.current, q = state.questions[i]; state.answers[i] = [...q.a]; revealAnswer(); });
  const n1 = { note: await vis(pg, '#ansNote'), divider: await vis(pg, '#answerBox .divider') };
  log(n1.note === 1 && n1.divider === 1, 'AC3 note shown with divider when note exists', n1);
  await pg.$eval('#answerBox', e => e.scrollIntoView());
  await pg.screenshot({ path: `${SHOTS}/07-practice-off-note.png` });
  // count all questions without note across all exams: divider hidden for each
  const noNote = await pg.evaluate(() => {
    let bad = 0, n = 0;
    for (let ex = 1; ex <= 3; ex++) { pendingMode = 'practice'; startExam(ex);
      state.questions.forEach((q, i) => { if (q.note) return; n++; state.current = i; renderQuestion(); state.answers[i] = [...q.a]; revealAnswer();
        const d = document.querySelector('#answerBox .divider'); if (d && d.getClientRects().length) bad++; }); }
    return { n, bad };
  });
  log(noNote.n > 0 && noNote.bad === 0, 'AC3 no-note questions (exams 1-3): no empty divider', noNote);

  // ── AC2 study fact cards + memory aid; S-202 search ──
  await pg.goto(APP);
  await pg.click('#modeStudy');
  const st = { yue: await vis(pg, '.fact-yue'), mem: await vis(pg, '.fact-mem'), ph: await pg.$eval('#studySearch', e => e.placeholder) };
  log(st.yue === 0 && st.mem > 0, 'AC2/AC3 Study OFF: no fact-yue, memory aid present', st);
  await pg.screenshot({ path: `${SHOTS}/08-study-off.png` });
  await pg.fill('#studySearch', '國王'); await pg.waitForTimeout(400);
  const cnt = await pg.$eval('#studyCount', e => e.textContent);
  log(true, 'INFO S-202: OFF + Cantonese search "國王" → ' + cnt + ' / placeholder "' + st.ph + '"');
  await pg.screenshot({ path: `${SHOTS}/09-study-off-search-yue.png` });

  // ── plan reading cards ──
  const plan = await pg.evaluate(() => {
    const today = new Date().toISOString().slice(0, 10);
    const ex = new Date(Date.now() + 20 * 864e5).toISOString().slice(0, 10);
    const p = buildPlan({ examDate: ex, dailyMins: 120, restDays: [], level: 'none' }, today); writeStudyPlan(p);
    const ri = p.days[0].tasks.findIndex(t => t.type === 'read');
    if (ri < 0) return { ri };
    planShowFacts({ date: today, taskIndex: ri, from: today }, 0, false);
    return { ri, active: document.querySelector('.screen.active').id };
  });
  const pr = { yue: await vis(pg, '.fact-yue'), all: await pg.$$eval('.fact-yue', e => e.length), en: await vis(pg, '.fact-en, .fact-text') };
  log(plan.ri >= 0 && pr.all > 0 && pr.yue === 0, 'AC2 plan reading card OFF: fact-yue hidden', { plan, pr });
  await pg.screenshot({ path: `${SHOTS}/10-plan-reading-off.png` });

  // ── storage blocked: switch behaviour ──
  const ctx2 = await b.newContext({ viewport: { width: 390, height: 844 } });
  const p2 = await ctx2.newPage(); const e2 = []; p2.on('pageerror', e => e2.push(e.message));
  await p2.addInitScript(() => { Storage.prototype.setItem = function () { throw new DOMException('blocked', 'SecurityError'); }; });
  await p2.goto(APP);
  await p2.click('#settingsBtn'); await p2.click('#translationSwitch');
  const blocked = await p2.evaluate(() => ({ attr: document.documentElement.dataset.translation || 'on', pill: byId('settingsTransPill').textContent }));
  log(e2.length === 0, 'storage setItem throws: no page error; result ' + JSON.stringify(blocked));
  await ctx2.close();

  // ── raw keys anywhere (en + zh) with OFF ──
  for (const lang of ['en', 'zh-HK']) {
    await pg.goto(APP); await pg.evaluate(l => setLang(l), lang);
    await pg.click('#settingsBtn');
    const rk = await rawKeys(pg);
    log(rk.length === 0, `AC5 ${lang} OFF home+popover no raw keys`, rk);
    await pg.screenshot({ path: `${SHOTS}/11-popover-off-${lang}.png` });
    await pg.keyboard.press('Escape');
  }
  await pg.evaluate(() => setLang('en'));

  // ── AC5 width / text-size / language matrix ──
  const matrix = [];
  for (const w of [320, 360, 400]) for (const size of ['small', 'large']) for (const lang of ['en', 'zh-HK']) for (const tr of ['on', 'off']) {
    const c = await b.newContext({ viewport: { width: w, height: 760 } }); const p = await c.newPage();
    await p.goto(APP);
    await p.evaluate(([size, lang, tr]) => { localStorage.setItem('lifeuk.fontSize', JSON.stringify(size)); localStorage.setItem('lifeuk.uiLang', JSON.stringify(lang)); localStorage.setItem('lifeuk.translation', JSON.stringify(tr)); }, [size, lang, tr]);
    await p.goto(APP);
    await p.click('#settingsBtn');
    const pop = await hscroll(p);
    const rowFit = await p.evaluate(() => { const r = byId('settingsTransRow').getBoundingClientRect(), s = byId('translationSwitch').getBoundingClientRect(); return { rowR: Math.round(r.right), swR: Math.round(s.right), vw: innerWidth, swInside: s.right <= r.right + 0.5 && s.width > 0 }; });
    if (w === 320 && tr === 'off') await p.screenshot({ path: `${SHOTS}/12-popover-${w}-${size}-${lang}-${tr}.png` });
    await p.keyboard.press('Escape');
    await p.evaluate(() => { pendingMode = 'practice'; startExam(1); state.current = state.questions.findIndex(q => q.note && q.o.some(o => o.length > 40)); if (state.current < 0) state.current = 0; renderQuestion(); });
    if (tr === 'on') await p.click('#yueToggle');
    const quizB = await hscroll(p);
    await p.evaluate(() => { const i = state.current, q = state.questions[i]; state.answers[i] = [...q.a]; revealAnswer(); });
    const quizA = await hscroll(p);
    if (w === 320 && size === 'large') await p.screenshot({ path: `${SHOTS}/13-quiz-${w}-${size}-${lang}-${tr}.png`, fullPage: true });
    const rk = await rawKeys(p);
    const ok = pop.page <= 0 && pop.popRight <= 0 && rowFit.swInside && quizB.page <= 0 && quizA.page <= 0 && rk.length === 0;
    matrix.push({ w, size, lang, tr, ok, pop, rowFit: rowFit.swInside, quizB: quizB.page, quizA: quizA.page, rk: rk.length });
    await c.close();
  }
  const bad = matrix.filter(m => !m.ok);
  log(bad.length === 0, `AC5 matrix ${matrix.length} combos (320/360/400 × small/large × en/zh × on/off): popover + quiz no h-scroll, switch inside row, no raw keys`, bad);

  // ── AC6 plan entry hidden + row visible (via study-plan switch off too) ──
  await fresh(pg);
  await pg.click('#settingsBtn');
  const planSwitch = await pg.$('#infoPlanRow:not([hidden]) [role=switch]');
  log(true, 'INFO plan row shown on fresh: ' + !!planSwitch);

  log(errs.length === 0, 'no page errors / console warnings', errs);
  await b.close();
  const fails = res.filter(r => !r.ok).length;
  console.log(fails ? `EXPLORE ${fails} FAIL` : 'EXPLORE ALL OK');
})().catch(e => { console.error('CRASH', e); process.exit(1); });
