// QA v1.4.3: html { background: navy; overscroll-behavior-y: none } + body { overscroll-behavior-y: none }.
// Fresh, UNSEEDED browser (zh-HK + large defaults). Every screen at several viewports, at scroll top / middle / bottom:
//   - canvas exposed = a grid point (every 8px) where <body> is not in elementsFromPoint (the navy canvas shows there)
//   - navy pixels in the viewport screenshot that sit on an exposed point (what the user would see)
//   - header pinned (top 0) whenever scrollY > 0
// Plus: ⚙ / ⓘ popover open + close, confirm modal open + backdrop scan + cancel, toast, .plan-day-scroll scroll +
// overscroll containment, print media (screenshot + PDF with / without background graphics), simulated top bounce.
// Screenshots only for findings -> ./shots/v143-*.png
//   NODE_PATH=... CHROMIUM_PATH=... node 2026-10-12_qa-v143-overscroll.js
const { chromium } = require('playwright-core');
const path = require('path');
const fs = require('fs');
const { execFileSync } = require('child_process');
const APP = process.env.APP_URL || 'file://' + path.resolve(__dirname, '../../../index.html');
const SHOTS = path.join(__dirname, 'shots');
const TMP = process.env.QA_TMP || require('os').tmpdir();
const launchOpts = { args: ['--no-sandbox'] };
if (process.env.CHROMIUM_PATH) launchOpts.executablePath = process.env.CHROMIUM_PATH;
const VIEWPORTS = [
  { width: 320, height: 568 }, { width: 390, height: 844 }, { width: 768, height: 1024 }, { width: 768, height: 1600 },
  { width: 1280, height: 800 }, { width: 1280, height: 1600 }, { width: 844, height: 390 }, // landscape phone: popover taller than the viewport
];
const res = [];
const findings = [];
const log = (ok, m, extra) => { res.push(ok); if (!ok) findings.push(m); console.log((ok ? 'ok  ' : 'BUG ') + m + (extra !== undefined ? ' ' + JSON.stringify(extra) : '')); };

const NAVY_RGB = pg => pg.evaluate(() => {
  const i = document.createElement('i'); document.body.appendChild(i);
  i.style.color = getComputedStyle(document.documentElement).getPropertyValue('--navy').trim();
  const c = getComputedStyle(i).color; i.remove(); return c.match(/\d+/g).map(Number);
});

// exposed canvas points + navy pixels on them, at the current scroll position
async function scanViewport(pg, navy) {
  const b64 = (await pg.screenshot()).toString('base64');
  return pg.evaluate(async ({ src, navy }) => {
    const img = new Image(); img.src = 'data:image/png;base64,' + src; await img.decode();
    const c = document.createElement('canvas'); c.width = img.width; c.height = img.height;
    const ctx = c.getContext('2d'); ctx.drawImage(img, 0, 0);
    const d = ctx.getImageData(0, 0, c.width, c.height).data;
    const W = innerWidth, H = innerHeight;
    let exposed = 0, navyExposed = 0, firstExposed = null;
    for (let y = 1; y < H; y += 8) for (let x = 1; x < W; x += 8) {
      if (document.elementsFromPoint(x, y).includes(document.body)) continue;
      exposed++; if (!firstExposed) firstExposed = [x, y];
      const k = (y * c.width + x) * 4;
      if (Math.abs(d[k] - navy[0]) < 4 && Math.abs(d[k + 1] - navy[1]) < 4 && Math.abs(d[k + 2] - navy[2]) < 4) navyExposed++;
    }
    // bottom edge strip (last 4 rows): any exact navy pixel not covered by an element with a navy-ish background
    let edgeNavy = 0;
    for (let y = H - 4; y < H; y++) for (let x = 0; x < W; x += 2) {
      const k = (y * c.width + x) * 4;
      if (Math.abs(d[k] - navy[0]) < 4 && Math.abs(d[k + 1] - navy[1]) < 4 && Math.abs(d[k + 2] - navy[2]) < 4
        && !document.elementsFromPoint(x, y).includes(document.body)) edgeNavy++;
    }
    const h = document.querySelector('header').getBoundingClientRect();
    return { exposed, navyExposed, edgeNavy, firstExposed, scrollY: Math.round(scrollY), max: document.documentElement.scrollHeight - H,
      headerTop: Math.round(h.top), bodyH: Math.round(document.body.getBoundingClientRect().height), docH: document.documentElement.scrollHeight };
  }, { src: b64, navy });
}

async function scan(pg, navy, tag, name) {
  const restore = await pg.evaluate(() => scrollY);
  const out = [];
  for (const pos of ['top', 'middle', 'bottom']) {
    await pg.evaluate(p => { const m = document.documentElement.scrollHeight - innerHeight; window.scrollTo(0, p === 'top' ? 0 : p === 'middle' ? m / 2 : m); }, pos);
    await pg.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));
    const s = await scanViewport(pg, navy);
    const sticky = s.scrollY === 0 || s.headerTop === 0;
    const ok = s.exposed === 0 && s.edgeNavy === 0 && sticky;
    if (!ok) await pg.screenshot({ path: `${SHOTS}/v143-${tag}-${name}-${pos}.png` });
    out.push({ pos, ok, s });
    log(ok, `${tag} ${name} @${pos}: exposed=${s.exposed} navyExposed=${s.navyExposed} edgeNavy=${s.edgeNavy} y=${s.scrollY}/${s.max} header=${s.headerTop}`,
      ok ? undefined : s);
  }
  await pg.evaluate(y => window.scrollTo(0, y), restore);
  return out;
}

async function popoverCheck(pg, navy, tag, btn, pop) {
  await pg.evaluate(() => window.scrollTo(0, 0));
  await pg.click('#' + btn);
  await pg.waitForSelector(`#${pop}.show`);
  const g = await pg.evaluate(id => { const r = byId(id).getBoundingClientRect(); return { top: Math.round(r.top), bottom: Math.round(r.bottom), vh: innerHeight, docH: document.documentElement.scrollHeight }; }, pop);
  await scan(pg, navy, tag, pop + '-open');
  // reachability: a popover taller than the viewport — can its bottom be scrolled into view?
  if (g.bottom > g.vh) {
    await pg.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
    const after = await pg.evaluate(id => Math.round(byId(id).getBoundingClientRect().bottom), pop);
    log(true, `${tag} ${pop} taller than viewport (info): bottom ${g.bottom} > vh ${g.vh}; after page scroll to end bottom=${after} (reachable=${after <= g.vh})`);
    await pg.evaluate(() => window.scrollTo(0, 0));
  }
  await pg.keyboard.press('Escape');
  const closedEsc = await pg.evaluate(id => !byId(id).classList.contains('show'), pop);
  await pg.click('#' + btn);
  await pg.mouse.click(5, g.vh - 5); // outside click
  const closedOut = await pg.evaluate(id => !byId(id).classList.contains('show'), pop);
  log(closedEsc && closedOut, `${tag} ${pop} closes on Escape and outside click`, { closedEsc, closedOut });
}

(async () => {
  fs.mkdirSync(SHOTS, { recursive: true });
  const b = await chromium.launch(launchOpts);
  for (const vp of VIEWPORTS) {
    const tag = `${vp.width}x${vp.height}`;
    const ctx = await b.newContext({ viewport: vp }); // fresh, NOT seeded
    const pg = await ctx.newPage();
    const errs = []; pg.on('pageerror', e => errs.push(e.message));
    await pg.goto(APP);
    await pg.waitForSelector('#examGrid *', { state: 'attached' });
    const navy = await NAVY_RGB(pg);
    const d = await pg.evaluate(() => ({ lang: document.documentElement.lang, font: document.documentElement.dataset.fontSize,
      html: getComputedStyle(document.documentElement).backgroundColor, ob: getComputedStyle(document.documentElement).overscrollBehaviorY,
      bob: getComputedStyle(document.body).overscrollBehaviorY }));
    log(d.lang === 'zh-HK' && d.font === 'large' && d.ob === 'none' && d.bob === 'none', `${tag} defaults + overscroll none`, d);

    await scan(pg, navy, tag, 'home');
    await popoverCheck(pg, navy, tag, 'settingsBtn', 'settingsPop');
    await popoverCheck(pg, navy, tag, 'infoBtn', 'infoPop');

    // toast via the 🌐 translation switch in ⚙ (toggle twice so the state ends where it began)
    await pg.click('#settingsBtn');
    if (await pg.$('#translationSwitch:visible')) {
      await pg.click('#translationSwitch');
      await pg.keyboard.press('Escape');
      const shown = await pg.evaluate(() => !byId('appToast').hidden);
      log(shown, `${tag} toast shown`);
      await scan(pg, navy, tag, 'toast');
      await pg.click('#settingsBtn'); await pg.click('#translationSwitch'); await pg.keyboard.press('Escape');
      await pg.evaluate(() => hideToast());
    } else { await pg.keyboard.press('Escape'); log(false, `${tag} translation switch missing`); }

    // Study, 4 tabs
    await pg.click('[data-action="openStudy"]');
    await pg.waitForSelector('#screenStudy.active');
    for (const tab of await pg.$$eval('#studyTabs [data-arg]', els => els.map(e => e.dataset.arg))) {
      await pg.click(`#studyTabs [data-arg="${tab}"]`);
      await scan(pg, navy, tag, 'study-' + tab);
    }
    await pg.evaluate(() => goHome());

    // Practice
    await pg.click('#modePractice');
    await scan(pg, navy, tag, 'home-practice');
    await pg.click('#ptabExam');
    await pg.click('#examGrid button');
    await pg.waitForSelector('#screenQuiz.active');
    await scan(pg, navy, tag, 'practice-q');
    await pg.click('#opt0');
    if (!(await pg.$('#answerBox.show'))) await pg.click('#nextBtn');
    await scan(pg, navy, tag, 'practice-answered');
    await pg.evaluate(() => goHome());

    // Exam + confirm modal + result
    await pg.click('#modeExam');
    await pg.click('#examGrid button');
    await pg.waitForSelector('#screenQuiz.active');
    await scan(pg, navy, tag, 'exam-q');
    await pg.evaluate(() => { state.questions.forEach((q, i) => { if (i < state.questions.length - 3) state.answers[i] = [...q.a]; }); state.current = state.questions.length - 1; renderQuestion(); });
    await pg.evaluate(() => submitExam());
    const modal = await pg.$('#confirmModal.show');
    log(!!modal, `${tag} confirm modal opens`);
    if (modal) {
      await scan(pg, navy, tag, 'confirm-modal');
      const cover = await pg.evaluate(() => { const r = byId('confirmModal').getBoundingClientRect(); return [r.top, r.left, Math.round(r.width), Math.round(r.height), innerWidth, innerHeight]; });
      log(cover[0] === 0 && cover[2] === vp.width && cover[3] === vp.height, `${tag} modal backdrop covers viewport`, cover);
      await pg.click('#confirmCancel');
      const closed = await pg.evaluate(() => !byId('confirmModal').classList.contains('show'));
      log(closed, `${tag} confirm modal closes on Cancel`);
      await pg.evaluate(() => submitExam());
      await pg.click('#confirmOk');
    }
    await pg.evaluate(() => { if (!byId('screenResult').classList.contains('active')) finishExam(); });
    await pg.waitForSelector('#screenResult.active');
    await scan(pg, navy, tag, 'result');
    await pg.evaluate(() => goHome());

    // Plan: goal → schedule (+ inner scroller) → day → runner
    const cta = await pg.$('[data-action="openPlanGoal"]');
    if (cta) {
      await cta.click();
      await pg.waitForSelector('#screenPlanGoal.active');
      await scan(pg, navy, tag, 'plan-goal');
      if (await pg.$('#planCreateBtn:visible')) await pg.click('#planCreateBtn'); else await pg.evaluate(() => planCreate());
      await pg.waitForSelector('#screenPlanSchedule.active');
      await scan(pg, navy, tag, 'plan-schedule');

      // .plan-day-scroll: wheel scrolls it; at its end further wheel does not chain to the page
      await pg.evaluate(() => { window.scrollTo(0, 0); byId('planDayList').scrollTop = 0; byId('planDayList').classList.add('plan-jump'); });
      await pg.$eval('#planDayList', e => e.scrollIntoView({ block: 'center' }));
      const box = await (await pg.$('#planDayList')).boundingBox();
      const sc = await pg.evaluate(() => ({ sh: byId('planDayList').scrollHeight, ch: byId('planDayList').clientHeight, ob: getComputedStyle(byId('planDayList')).overscrollBehaviorY }));
      await pg.evaluate(() => { byId('planDayList').scrollTop = 0; });
      await pg.mouse.move(box.x + box.width / 2, box.y + Math.min(box.height / 2, 100));
      const y0 = await pg.evaluate(() => scrollY);
      await pg.mouse.wheel(0, 200); await pg.waitForTimeout(250);
      const st1 = await pg.evaluate(() => byId('planDayList').scrollTop);
      await pg.evaluate(() => { const e = byId('planDayList'); e.scrollTop = e.scrollHeight; });
      await pg.waitForTimeout(100);
      const y1 = await pg.evaluate(() => scrollY);
      await pg.mouse.wheel(0, 400); await pg.waitForTimeout(300);
      const y2 = await pg.evaluate(() => scrollY);
      const pageCanScroll = await pg.evaluate(() => document.documentElement.scrollHeight > innerHeight + scrollY + 1);
      const scrolls = sc.sh > sc.ch;
      log((!scrolls || st1 > 0) && sc.ob === 'contain' && (!pageCanScroll || y2 === y1), `${tag} .plan-day-scroll scrolls (scrollTop ${st1}) and contains overscroll (page y ${y1} -> ${y2}, page can scroll=${pageCanScroll})`, { ...sc, y0 });
      await pg.evaluate(() => byId('planDayList').classList.remove('plan-jump'));

      await pg.click('#screenPlanSchedule [data-action="openPlanDay"]').catch(() => pg.evaluate(() => openPlanDay()));
      await pg.waitForSelector('#screenPlanDay.active');
      await scan(pg, navy, tag, 'plan-day');
      const task = await pg.$('#planTaskList [data-action="planOpenTask"]');
      if (task) { await task.click(); await pg.waitForSelector('#screenPlanRun.active, #screenQuiz.active'); await scan(pg, navy, tag, 'plan-run'); }
      await pg.evaluate(() => goHome());
      await scan(pg, navy, tag, 'home-with-plan');

      // Plan reset → danger confirm modal (another modal variant)
      await pg.evaluate(() => openPlanSchedule && openPlanSchedule());
      const reset = await pg.$('#screenPlanSchedule.active [data-action="planAskReset"]');
      if (reset) {
        await reset.click();
        if (await pg.$('#confirmModal.show')) { await scan(pg, navy, tag, 'plan-reset-modal'); await pg.click('#confirmCancel'); }
      }
      await pg.evaluate(() => goHome());
    } else log(false, `${tag} plan entry card missing`);

    // simulated top bounce (as tests/overscroll-test.js): the gap above the header is navy
    await pg.evaluate(() => window.scrollTo(0, 0));
    await pg.evaluate(() => { document.documentElement.style.transform = 'translateY(200px)'; });
    const gap = await pg.screenshot({ clip: { x: 0, y: 0, width: vp.width, height: 180 } });
    await pg.evaluate(() => { document.documentElement.style.transform = ''; });
    const gapCols = await pg.evaluate(async src => {
      const img = new Image(); img.src = 'data:image/png;base64,' + src; await img.decode();
      const c = document.createElement('canvas'); c.width = img.width; c.height = img.height; const ctx = c.getContext('2d'); ctx.drawImage(img, 0, 0);
      const dd = ctx.getImageData(0, 0, c.width, c.height).data; const s = new Set();
      for (let i = 0; i < dd.length; i += 4) s.add(`${dd[i]},${dd[i + 1]},${dd[i + 2]}`); return [...s];
    }, gap.toString('base64'));
    log(gapCols.length === 1 && gapCols[0] === navy.join(','), `${tag} simulated top bounce: gap is navy only`, gapCols.slice(0, 4));

    // print media: on-screen render with print styles (viewport + full page)
    await pg.emulateMedia({ media: 'print' });
    await scan(pg, navy, tag, 'print-home');
    await pg.emulateMedia({ media: 'screen' });

    log(errs.length === 0, `${tag} no page errors`, errs);
    await ctx.close();
  }

  // print to PDF (A4) with and without "background graphics", rasterised: what share of each page is navy?
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 } });
  const pg = await ctx.newPage();
  await pg.goto(APP);
  await pg.waitForSelector('#examGrid *', { state: 'attached' });
  const navy = await NAVY_RGB(pg);
  const screens = { home: () => {}, study: () => { openStudy(); } };
  for (const [name, fn] of Object.entries(screens)) {
    await pg.evaluate(fn);
    for (const bg of [false, true]) {
      const pdf = path.join(TMP, `v143-print-${name}-${bg ? 'bg' : 'nobg'}.pdf`);
      await pg.pdf({ path: pdf, format: 'A4', printBackground: bg });
      const prefix = pdf.replace(/\.pdf$/, '');
      execFileSync('pdftoppm', ['-r', '30', '-f', '1', '-l', '3', pdf, prefix]);
      const pages = fs.readdirSync(TMP).filter(f => f.startsWith(path.basename(prefix) + '-') && f.endsWith('.ppm')).sort();
      for (const f of pages) {
        const buf = fs.readFileSync(path.join(TMP, f));
        // P6 header: "P6\n<w> <h>\n255\n"
        const m = buf.toString('latin1', 0, 40).match(/^P6\s+(\d+)\s+(\d+)\s+255\s/);
        const off = m[0].length, n = Number(m[1]) * Number(m[2]);
        let nav = 0;
        for (let i = 0; i < n; i++) { const k = off + i * 3; if (Math.abs(buf[k] - navy[0]) < 6 && Math.abs(buf[k + 1] - navy[1]) < 6 && Math.abs(buf[k + 2] - navy[2]) < 6) nav++; }
        const pct = Math.round(nav / n * 1000) / 10;
        // the header is navy by design (~58px of an A4 page ≈ 5–8%); flag a page that is mostly navy
        log(pct < 20, `print PDF ${name} printBackground=${bg} ${f}: navy ${pct}% of page`);
        if (pct >= 20) execFileSync('convert', [path.join(TMP, f), `${SHOTS}/v143-${f.replace('.ppm', '.png')}`]);
      }
    }
  }
  await ctx.close();
  await b.close();
  console.log(res.every(Boolean) ? `V143 ALL OK ${res.length}` : `V143 ${res.filter(x => !x).length} BAD / ${res.length}`);
  if (findings.length) console.log('FINDINGS:\n' + findings.join('\n'));
})().catch(e => { console.error(e); process.exit(1); });
