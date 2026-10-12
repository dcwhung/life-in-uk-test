// QA v1.4.1: translation toast matrix + edge cases, 備註 sweep. Run: NODE_PATH=/opt/node-tools/node_modules node <this>
const { chromium } = require('playwright-core');
const path = require('path');
const APP = 'file:///home/user/life-in-uk-test/index.html';
const SHOTS = path.join(__dirname, '..', 'screenshots', 'v141');
const WRONG = '備注', RIGHT = '備註';
const WORDS = { en: { off: 'Cantonese translation turned off', on: 'Cantonese translation turned on' }, 'zh-HK': { off: '已關閉廣東話翻譯', on: '已開啟廣東話翻譯' } };
const res = []; const log = (ok, m, x) => { res.push(ok); console.log((ok ? 'ok  ' : 'BUG ') + m + (x !== undefined ? ' ' + JSON.stringify(x) : '')); };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const rawKeys = pg => pg.evaluate(() => document.body.innerText.match(/\b(app|home|quiz|common|study|plan|exam|modal)\.[a-z]+[A-Z][a-zA-Z]*\b/g) || []);
const toast = pg => pg.evaluate(() => {
  const e = byId('appToast'), r = e.getBoundingClientRect(), se = document.scrollingElement, cs = getComputedStyle(e);
  const lh = parseFloat(cs.lineHeight);
  return { shown: !e.hidden && e.getClientRects().length > 0, text: e.textContent, left: Math.round(r.left), right: Math.round(innerWidth - r.right),
    bottom: Math.round(innerHeight - r.bottom), w: Math.round(r.width), h: Math.round(r.height), lines: Math.round((r.height - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom)) / lh),
    clipX: e.scrollWidth - e.clientWidth, clipY: e.scrollHeight - e.clientHeight, page: se.scrollWidth - se.clientWidth, fs: cs.fontSize,
    focusInToast: e.contains(document.activeElement), active: document.activeElement && document.activeElement.id };
});
async function setup(b, w, size, lang) {
  const c = await b.newContext({ viewport: { width: w, height: 760 } }); const p = await c.newPage(); const errs = [];
  p.on('pageerror', e => errs.push(e.message));
  await p.goto(APP);
  await p.evaluate(([s, l]) => { localStorage.clear(); localStorage.setItem('lifeuk.fontSize', JSON.stringify(s)); localStorage.setItem('lifeuk.uiLang', JSON.stringify(l)); }, [size, lang]);
  await p.goto(APP);
  return { c, p, errs };
}
async function goScreen(p, screen) {
  if (screen === 'practice') {
    await p.click('#modePractice'); await p.click('#ptabExam').catch(() => {});
    await p.click('#examGrid button'); await p.waitForSelector('#screenQuiz.active');
    await p.click('#opt0'); if (!(await p.$('#answerBox.show'))) await p.click('#nextBtn');
  } else if (screen === 'study') { await p.click('#modeStudy'); await p.waitForSelector('#screenStudy.active').catch(() => {}); }
}
async function toggle(p) { await p.click('#settingsBtn'); await p.click('#translationSwitch'); }

(async () => {
  const b = await chromium.launch({ args: ['--no-sandbox'] });

  // ── AC1 matrix: screen × lang × width × size ──
  const bad = []; let n = 0;
  for (const screen of ['home', 'practice', 'study']) for (const lang of ['en', 'zh-HK']) for (const w of [320, 390]) for (const size of ['small', 'large']) {
    const { c, p, errs } = await setup(b, w, size, lang); n++;
    const cls = await p.evaluate(() => document.documentElement.lang + '/' + (document.documentElement.dataset.fontSize || document.documentElement.className));
    await goScreen(p, screen);
    const before = await toast(p);
    await toggle(p); const off = await toast(p);
    const tag = `${screen}-${lang}-${w}-${size}`;
    if (screen !== 'practice' || w === 320) await sleep(450), await p.screenshot({ path: `${SHOTS}/toast-off-${tag}.png` });
    await toggle(p); const on = await toast(p);
    if (screen === 'home' || w === 320) await sleep(450), await p.screenshot({ path: `${SHOTS}/toast-on-${screen === 'home' ? '' : screen + '-'}${lang}-${w}-${size}.png` });
    const popOpen = await p.evaluate(() => byId('settingsPop').classList.contains('show'));
    const rk = await rawKeys(p);
    await sleep(2400 + 400); const gone = await toast(p);
    const fits = t => t.shown && t.left >= 15 && t.right >= 15 && t.clipX <= 0 && t.clipY <= 0 && t.page <= 0 && t.bottom > 0;
    const ok = !before.shown && fits(off) && fits(on) && off.text === WORDS[lang].off && on.text === WORDS[lang].on && !on.focusInToast && on.active === 'settingsBtn'
      && !popOpen && !gone.shown && rk.length === 0 && errs.length === 0;
    if (!ok) bad.push({ tag, cls, before: before.shown, off, on, popOpen, gone: gone.shown, rk, errs });
    console.log((ok ? 'ok  ' : 'BUG ') + tag, cls, `off[${off.w}x${off.h} L${off.lines} ${off.left}/${off.right} fs${off.fs}]`, `on[${on.w}x${on.h} L${on.lines} ${on.left}/${on.right}]`, 'focus=' + on.active, 'gone=' + !gone.shown);
    await c.close();
  }
  log(bad.length === 0, `AC1 toast matrix ${n} combos (Home/Practice answered/Study × en/zh-HK × 320/390 × small/large)`, bad.length ? bad : undefined);

  // ── edge cases (390 en default) ──
  {
    const { c, p, errs } = await setup(b, 390, 'large', 'en');
    // E1 R-002: confirm modal open → switch click does nothing, no toast
    await p.evaluate(() => showConfirm({ title: 'x', message: 'y', okLabel: 'ok', cancelLabel: 'no', onOk: () => {} }));
    await p.evaluate(() => byId('translationSwitch').click());
    const e1 = await toast(p);
    log(!e1.shown && await p.evaluate(() => document.documentElement.dataset.translation === undefined), 'E1 R-002 confirm modal open: no toggle, no toast', e1.text);
    await p.goto(APP);
    // E2 rapid 5 toggles (real clicks): final = off, toast says off
    for (let i = 0; i < 5; i++) await toggle(p);
    const e2 = await toast(p); const st2 = await p.evaluate(() => document.documentElement.dataset.translation || 'on');
    log(st2 === 'off' && e2.text === WORDS.en.off && e2.shown, 'E2 5 rapid toggles: state off, toast shows latest (off)', { st2, t: e2.text });
    // E3 rapid via ACTIONS without awaiting UI (burst of 6 in one tick) → back to off→... even count = original
    await p.evaluate(() => { for (let i = 0; i < 6; i++) ACTIONS.toggleTranslation(); });
    const e3 = await toast(p); const st3 = await p.evaluate(() => document.documentElement.dataset.translation || 'on');
    log(st3 === 'off' && e3.text === WORDS.en.off, 'E3 6 toggles in one tick: state unchanged (off), toast matches state', { st3, t: e3.text });
    // E4 timer resets on each toggle: toggle, 1600ms, toggle, 1600ms → still shown; +1200ms → hidden
    await p.evaluate(() => localStorage.removeItem('lifeuk.translation')); await p.goto(APP); await sleep(100); // start from On
    await toggle(p); await sleep(1600); await toggle(p); await sleep(1600);
    const e4a = await toast(p); await sleep(1200); const e4b = await toast(p);
    log(e4a.shown && e4a.text === WORDS.en.on && !e4b.shown, 'E4 timeout restarts on each toggle (still shown 1.6s after 2nd, gone after 2.8s)', { a: e4a, b: e4b.shown });
    // E5 keyboard Space on switch: toast + focus back on ⚙, popover closed
    await p.click('#settingsBtn'); await p.focus('#translationSwitch'); await p.keyboard.press('Space');
    const e5 = await toast(p); const pop5 = await p.evaluate(() => byId('settingsPop').classList.contains('show'));
    log(e5.shown && e5.text === WORDS.en.off && e5.active === 'settingsBtn' && !pop5, 'E5 keyboard Space: toast shown, focus back to ⚙, popover closed', { a: e5.active, pop5 });
    // E6 reopen ⚙ while toast shows: popover and toast don't overlap, toast not focusable, Esc closes popover only
    await p.click('#settingsBtn');
    const e6 = await p.evaluate(() => { const a = byId('settingsPop').getBoundingClientRect(), t = byId('appToast').getBoundingClientRect();
      return { overlap: !(a.bottom <= t.top || t.bottom <= a.top || a.right <= t.left || t.right <= a.left), popB: Math.round(a.bottom), toastT: Math.round(t.top), toastShown: !byId('appToast').hidden, tabbable: byId('appToast').tabIndex }; });
    await p.keyboard.press('Escape');
    const e6b = await p.evaluate(() => ({ pop: byId('settingsPop').classList.contains('show'), toast: !byId('appToast').hidden, focus: document.activeElement.id }));
    log(!e6.overlap && e6.toastShown && e6.tabbable < 0 && !e6b.pop && e6b.toast && e6b.focus === 'settingsBtn', 'E6 popover reopened during toast: no overlap, Esc closes popover only, focus ⚙', { e6, e6b });
    // E7 aria: polite live region, toast never gets focus
    const e7 = await p.evaluate(() => { const r = byId('appToast').parentElement; return { role: r.getAttribute('role'), live: r.getAttribute('aria-live'), pe: getComputedStyle(byId('appToast')).pointerEvents }; });
    log(e7.role === 'status' && e7.live === 'polite' && e7.pe === 'none', 'E7 toast in role=status aria-live=polite, pointer-events none', e7);
    // E8 Practice 320 large: toast over the bottom of the quiz does not block a click on Next
    await c.close();
  }
  {
    const { c, p, errs } = await setup(b, 320, 'large', 'zh-HK');
    await goScreen(p, 'practice');
    await toggle(p);
    const cur0 = await p.evaluate(() => state.current);
    const hit = await p.evaluate(() => { const nb = byId('nextBtn'); nb.scrollIntoView({ block: 'end' }); const r = nb.getBoundingClientRect(), t = byId('appToast').getBoundingClientRect();
      const x = r.left + r.width / 2, y = r.top + r.height / 2; return { under: x >= t.left && x <= t.right && y >= t.top && y <= t.bottom, hitId: document.elementFromPoint(x, y)?.closest('#nextBtn') ? 'nextBtn' : document.elementFromPoint(x, y)?.id }; });
    await p.click('#nextBtn');
    const cur1 = await p.evaluate(() => state.current);
    log(cur1 === cur0 + 1 && hit.hitId === 'nextBtn', 'E8 zh-HK 320 large Practice: Next button clickable while the toast shows', { hit, cur0, cur1 });
    await sleep(450), await p.screenshot({ path: `${SHOTS}/toast-practice-next-zh-HK-320-large.png` });
    // E9 study plan toast then translation toast: the newer replaces
    await p.goto(APP);
    await p.evaluate(() => showToast(t('plan.toastOn')));
    await toggle(p);
    const e9 = await toast(p);
    log(e9.text === WORDS['zh-HK'].on || e9.text === WORDS['zh-HK'].off, 'E9 a showing plan toast is replaced by the translation toast', e9.text);
    // E10 language switch while toast showing: toast keeps old-language text until timeout (no raw key)
    await p.click('#settingsBtn'); await p.click('[data-action="chooseLang"][data-arg="en"]');
    const e10 = await toast(p);
    log(!/\b(app|plan)\.[a-z]/i.test(e10.text), 'E10 switch language while toast shows: no raw key (text "' + e10.text + '")');
    log(errs.length === 0, 'E8-E10 no page errors', errs);
    await c.close();
  }

  // required screenshot: toast-on-en-320-large.png (Home)
  // (made by the matrix as toast-on-en-320-large.png)

  // ── AC2 備註 sweep ──
  for (const lang of ['en', 'zh-HK']) for (const tr of ['on', 'off']) {
    const { c, p, errs } = await setup(b, 390, 'small', lang);
    if (tr === 'off') { await p.evaluate(() => localStorage.setItem('lifeuk.translation', '"off"')); await p.goto(APP); }
    const found = []; const labels = {};
    const sweep = async name => { const r = await p.evaluate(([W]) => ({ inner: document.body.innerText.includes(W), dom: document.documentElement.outerHTML.includes(W), title: document.title.includes(W) }), [WRONG]);
      if (r.inner || r.dom || r.title) found.push({ name, ...r }); };
    await sweep('home');
    await p.click('#infoBtn'); await sweep('info');
    labels.info = await p.$eval('#infoIntro', e => e.textContent);
    await p.keyboard.press('Escape');
    await p.click('#settingsBtn'); await sweep('settings'); await p.keyboard.press('Escape');
    await p.evaluate(() => { pendingMode = 'practice'; startExam(1); state.current = state.questions.findIndex(q => q.note); renderQuestion(); const i = state.current, q = state.questions[i]; state.answers[i] = [...q.a]; revealAnswer(); });
    labels.ans = await p.$eval('#ansNote strong', e => e.textContent);
    await sweep('practice-answered');
    if (lang === 'zh-HK' && tr === 'on') { await p.$eval('#ansNote', e => e.scrollIntoView({ block: 'center' })); await sleep(450), await p.screenshot({ path: `${SHOTS}/note-label-zh-HK-390.png` }); }
    if (lang === 'en' && tr === 'off') { await p.$eval('#ansNote', e => e.scrollIntoView({ block: 'center' })); await sleep(450), await p.screenshot({ path: `${SHOTS}/note-label-en-390-off.png` }); }
    // all 17 exams answered: every note label
    const allLabels = await p.evaluate(() => { const s = new Set(); for (let ex = 1; ex <= EXAM_COUNT; ex++) { pendingMode = 'practice'; startExam(ex);
      state.questions.forEach((q, i) => { if (!q.note) return; state.current = i; renderQuestion(); state.answers[i] = [...q.a]; revealAnswer(); s.add(document.querySelector('#ansNote strong').textContent); }); } return [...s]; });
    labels.allAns = allLabels;
    await p.evaluate(() => { pendingMode = 'exam'; startExam(1); state.questions.forEach((q, i) => { state.answers[i] = [...q.a]; }); finishExam(); });
    labels.rv = await p.$$eval('.rv-note-label', els => [...new Set(els.map(e => e.textContent))]);
    await sweep('results-review');
    if (lang === 'zh-HK' && tr === 'on') { await p.$eval('.rv-note', e => e.scrollIntoView({ block: 'center' })); await sleep(450), await p.screenshot({ path: `${SHOTS}/review-note-label-zh-HK-390.png` }); }
    await p.evaluate(() => { pendingMode = 'practice'; startExam(5); setPracticeFlag(qKey(state.questions[0]), true); openFlagged(); }); await sweep('flagged');
    await p.evaluate(() => { pendingMode = 'practice'; startExam(12); state.current = state.questions.findIndex(q => q.origIdx === 5); renderQuestion(); const i = state.current, q = state.questions[i]; state.answers[i] = [...q.a]; revealAnswer(); });
    labels.similar = await p.evaluate(() => byId('similarBox') && byId('similarBox').getClientRects().length > 0);
    await sweep('similar');
    await p.evaluate(() => openStudy()); await sweep('study');
    const okL = labels.ans === '💡 ' + RIGHT + '：' && labels.allAns.length === 1 && labels.allAns[0] === labels.ans && labels.rv.length === 1 && labels.rv[0] === labels.ans
      && (lang !== 'zh-HK' || labels.info.includes(RIGHT));
    log(found.length === 0 && okL && errs.length === 0, `AC2 ${lang} translation ${tr}: 0 × ${WRONG} on 8 screens (innerText + DOM), labels 💡 ${RIGHT}：`, { found, labels: { ...labels, info: labels.info.slice(-20) } });
    await c.close();
  }
  console.log(res.every(Boolean) ? `ALL OK ${res.length}` : `FAIL ${res.filter(x => !x).length}/${res.length}`);
  await b.close();
})();
