// QA v0.70 S-102 / S-103 with real key presses (page.evaluate only seeds / reads state). node kbd070.js <root> <shotdir>
const { chromium } = require('playwright-core'); const path = require('path'); const fs = require('fs');
const ROOT = path.resolve(process.argv[2]); const SHOT = path.resolve(process.argv[3]); fs.mkdirSync(SHOT, { recursive: true });
const APP_URL = 'file://' + path.join(ROOT, 'index.html');
let pass = 0, fail = 0; const ok = (c, m) => { if (c) { pass++; console.log('ok:', m); } else { fail++; console.log('FAIL:', m); } };
(async () => {
  const b = await chromium.launch({ args: ['--no-sandbox'], executablePath: process.env.CHROMIUM_PATH });
  for (const lang of ['en', 'zh-HK']) for (const width of [390, 320]) {
    const tag = `[${lang} ${width}]`;
    const fresh = async (seed = {}) => { const pg = await b.newPage({ viewport: { width, height: 740 } }); const errs = []; pg.on('pageerror', e => errs.push(e.message));
      await pg.goto(APP_URL); await pg.evaluate(([l, s]) => { localStorage.clear(); localStorage.setItem('lifeuk.installDismissed', 'true'); localStorage.setItem('lifeuk.uiLang', JSON.stringify(l));
        Object.entries(s).forEach(([k, v]) => localStorage.setItem(k, v)); }, [lang, seed]); await pg.reload();
      await pg.evaluate(() => { window.__fin = 0; const f = finishExam; finishExam = (...a) => { window.__fin++; return f(...a); };
        window.__keys = []; document.addEventListener('keydown', e => window.__keys.push((e.repeat ? 'R' : '') + e.key), true); });
      pg.errs = errs; return pg; };
    const tabTo = async (pg, sel, k = 'Tab') => { for (let i = 0; i < 250; i++) { if (await pg.evaluate(s => document.activeElement.matches(s), sel)) return true; await pg.keyboard.press(k); } return false; };
    const st = pg => pg.evaluate(() => ({ scr: document.querySelector('.screen.active').id, modal: isConfirmOpen(), fin: window.__fin, ae: document.activeElement.id || document.activeElement.className || document.activeElement.tagName,
      cur: typeof state !== 'undefined' ? state.current : null, rep: window.__keys.filter(k => k.startsWith('R')).length }));
    const examByKeys = async (pg, n = 4) => { await tabTo(pg, '#modeExam'); await pg.keyboard.press('Enter'); await pg.waitForTimeout(420); await tabTo(pg, `#examGrid [data-arg="${n}"]`); await pg.keyboard.press('Enter'); await pg.waitForTimeout(420); };
    const toLast = async pg => { await tabTo(pg, '#navDots .dot:last-child'); await pg.keyboard.press('Enter'); await tabTo(pg, '#nextBtn'); };
    // ── S-103 ──
    { const pg = await fresh(); await examByKeys(pg); await toLast(pg);
      await pg.keyboard.down('Enter'); for (let i = 0; i < 8; i++) await pg.keyboard.down('Enter');
      const held = await st(pg); await pg.keyboard.up('Enter');
      ok(held.modal && held.fin === 0 && held.ae === 'confirmOk' && held.rep === 8 && held.scr === 'screenQuiz', `${tag} S-103 hold Enter on Submit (1 + 8 auto-repeat keydowns): prompt stays open, not submitted ${JSON.stringify(held)}`);
      await pg.waitForTimeout(900); await pg.screenshot({ path: path.join(SHOT, `s103-held-enter-${lang}-${width}.png`) });
      await pg.keyboard.press('Enter'); const after = await st(pg);
      ok(after.fin === 1 && after.scr === 'screenResult' && !after.modal, `${tag} S-103 a fresh Enter on OK then submits once ${JSON.stringify(after)}`);
      await pg.keyboard.press('Enter'); await pg.keyboard.press('Enter'); ok((await st(pg)).fin === 1, `${tag} stray Enter on results: still 1 finish`);
      ok(pg.errs.length === 0, `${tag} no page errors ${pg.errs}`); await pg.close(); }
    { const pg = await fresh(); await examByKeys(pg); await toLast(pg); await tabTo(pg, '#quickNext', 'Shift+Tab').catch(() => {});
      const onQuick = await pg.evaluate(() => document.activeElement.id === 'quickNext');
      if (onQuick) { for (let i = 0; i < 6; i++) await pg.keyboard.down('Enter'); const s = await st(pg); await pg.keyboard.up('Enter');
        ok(s.modal && s.fin === 0, `${tag} S-103 hold Enter on quick ✓: prompt open, not submitted ${JSON.stringify(s)}`);
        await pg.keyboard.press('Escape'); const e = await st(pg); ok(!e.modal && e.ae === 'quickNext', `${tag} Esc returns focus to quick ✓ ${JSON.stringify(e)}`); }
      else ok(false, `${tag} could not reach #quickNext`);
      await pg.close(); }
    { const pg = await fresh(); await examByKeys(pg); await tabTo(pg, '#screenQuiz .back-btn', 'Shift+Tab');
      for (let i = 0; i < 6; i++) await pg.keyboard.down('Enter'); const s = await st(pg); await pg.keyboard.up('Enter');
      ok(s.modal && s.ae === 'confirmCancel' && s.scr === 'screenQuiz', `${tag} S-103 hold Enter on ← Home: Leave prompt stays open on Cancel (no open/close flicker) ${JSON.stringify(s)}`);
      await pg.keyboard.press('Enter'); const c = await st(pg); ok(!c.modal && c.scr === 'screenQuiz', `${tag} then Enter = Cancel, still in the exam ${JSON.stringify(c)}`); await pg.close(); }
    { const pg = await fresh({ 'lifeuk.wrongList': '{"1.0":true,"2.3":true}' }); await tabTo(pg, '#modePractice'); await pg.keyboard.press('Enter'); await pg.waitForTimeout(420);
      await tabTo(pg, '[data-action="resetPracticeProgress"]'); for (let i = 0; i < 6; i++) await pg.keyboard.down('Enter'); const s = await st(pg); await pg.keyboard.up('Enter');
      const wl = await pg.evaluate(() => localStorage.getItem('lifeuk.wrongList'));
      ok(s.modal && s.ae === 'confirmCancel' && wl === '{"1.0":true,"2.3":true}', `${tag} S-103 hold Enter on Reset: prompt open on Keep, data kept ${JSON.stringify(s)}`); await pg.keyboard.press('Escape'); await pg.close(); }
    { const pg = await fresh(); await examByKeys(pg); await toLast(pg);
      await pg.keyboard.down(' '); for (let i = 0; i < 6; i++) await pg.keyboard.down(' '); await pg.keyboard.up(' '); const s = await st(pg);
      ok(s.modal && s.fin === 0 && s.ae === 'confirmOk', `${tag} hold Space on Submit (opens on keyup): prompt open, not submitted ${JSON.stringify(s)}`);
      await pg.keyboard.down(' '); await pg.keyboard.down(' '); await pg.keyboard.down(' '); await pg.keyboard.up(' '); const s2 = await st(pg);
      ok(s2.fin === 1, `${tag} a deliberate Space press on OK submits (Space is not blocked) ${JSON.stringify(s2)}`); await pg.close(); }
    { // regression: repeat Enter outside a prompt still works (Next held moves on several questions)
      const pg = await fresh(); await examByKeys(pg); await tabTo(pg, '#nextBtn');
      for (let i = 0; i < 4; i++) await pg.keyboard.down('Enter'); await pg.keyboard.up('Enter'); const s = await st(pg);
      ok(!s.modal && s.cur === 4, `${tag} held Enter on Next (no prompt) still advances 4 questions ${JSON.stringify(s)}`); await pg.close(); }
    // ── S-102 ──
    { const pg = await fresh(); await examByKeys(pg, 6);
      await pg.evaluate(() => { state.questions.forEach((q, i) => { if (i < 14) state.answers[i] = [...q.a]; else if (i < 20) state.answers[i] = [q.o.findIndex((_, k) => !q.a.includes(k))]; }); state.flags[2] = true; state.flags[16] = true; });
      await toLast(pg); await pg.keyboard.press('Enter'); await pg.keyboard.press('Enter'); await pg.waitForTimeout(420);
      ok((await st(pg)).scr === 'screenResult', `${tag} results by keyboard`);
      const chips = () => pg.evaluate(() => [...document.querySelectorAll('#reviewOrder .chip')].map(c => ({ arg: c.dataset.arg, active: c.classList.contains('active'), dis: c.disabled })));
      const ae = () => pg.evaluate(() => ({ arg: document.activeElement.dataset.arg, inChips: document.getElementById('reviewOrder').contains(document.activeElement), fv: document.activeElement.matches(':focus-visible'),
        n: document.querySelectorAll('#reviewList .review-item').length, tag: document.activeElement.tagName }));
      ok(await tabTo(pg, '#reviewOrder [data-arg="wrong"]'), `${tag} Tab reaches the "wrong" chip`);
      await pg.keyboard.press('Enter'); let a = await ae();
      ok(a.arg === 'wrong' && a.inChips && a.fv && a.n === 10, `${tag} S-102 Enter on "wrong": focus stays on the (new) wrong chip with ring, 10 items ${JSON.stringify(a)}`);
      await pg.waitForTimeout(300); await pg.screenshot({ path: path.join(SHOT, `s102-chip-focus-${lang}-${width}.png`) });
      await pg.keyboard.press('Tab'); a = await ae(); ok(a.arg === 'flagged', `${tag} next Tab goes to the flagged chip (not the page top) ${JSON.stringify(a)}`);
      await pg.keyboard.press('Space'); a = await ae(); ok(a.arg === 'flagged' && a.fv && a.n === 2, `${tag} Space on "flagged": focus kept, 2 items ${JSON.stringify(a)}`);
      await pg.keyboard.press('Shift+Tab'); await pg.keyboard.press('Shift+Tab'); a = await ae(); ok(a.arg === 'all', `${tag} Shift+Tab ×2 → "all" chip ${JSON.stringify(a)}`);
      await pg.keyboard.press('Enter'); a = await ae(); ok(a.arg === 'all' && a.n === 24, `${tag} Enter on "all": focus kept, 24 items ${JSON.stringify(a)}`);
      for (let i = 0; i < 5; i++) await pg.keyboard.press('Enter'); a = await ae(); ok(a.arg === 'all' && a.n === 24, `${tag} repeated Enter on the active chip: idempotent ${JSON.stringify(a)}`);
      await pg.keyboard.press('Tab'); await pg.keyboard.press('Tab'); await pg.keyboard.press('Tab'); a = await ae(); ok(!a.inChips, `${tag} Tab past the chips leaves the chip row ${JSON.stringify(a)}`);
      // pointer: click a chip → focus moves to the chosen chip without a ring
      await pg.click('#reviewOrder [data-arg="wrong"]'); a = await ae();
      ok(a.n === 10 && (!a.inChips || !a.fv), `${tag} mouse click on a chip: no focus ring ${JSON.stringify(a)}`);
      // focus elsewhere (not in chips) + chip action from pointer: focus not stolen
      await pg.click('#reviewList .review-item'); await pg.click('#reviewOrder [data-arg="all"]'); a = await ae(); ok(a.n === 24 && !a.fv, `${tag} mouse after mouse: no ring ${JSON.stringify(a)}`);
      ok(pg.errs.length === 0, `${tag} no page errors ${pg.errs}`); await pg.close(); }
    { // disabled chip (no flagged): skipped by Tab, Enter on wrong still keeps focus
      const pg = await fresh(); await examByKeys(pg, 7); await pg.evaluate(() => { state.questions.forEach((q, i) => { if (i < 20) state.answers[i] = [...q.a]; }); });
      await toLast(pg); await pg.keyboard.press('Enter'); await pg.keyboard.press('Enter'); await pg.waitForTimeout(420);
      await tabTo(pg, '#reviewOrder [data-arg="wrong"]'); await pg.keyboard.press('Enter'); await pg.keyboard.press('Tab');
      const a = await pg.evaluate(() => ({ arg: document.activeElement.dataset.arg, flaggedDisabled: document.querySelector('#reviewOrder [data-arg="flagged"]').disabled }));
      ok(a.flaggedDisabled && a.arg !== 'flagged', `${tag} disabled "flagged" chip skipped by Tab after the redraw ${JSON.stringify(a)}`); await pg.close(); }
  }
  await b.close(); console.log(`\n${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
