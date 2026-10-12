// v2.0.0 desktop layout — global overlays (mockup mockups/v2.0.0/desktop-overlays.html A; handoff §3 #12):
// - ⚙ popover under ⚙, its right edge on the header content's right edge, 420px × 1.2 wide
// - ⓘ popover under ⓘ, its left edge on the header content's left edge, 560px × 1.2 wide
// - both --space-5 under the header (mockup placePops: 10px, ×1.2); the arrow (js/components/popover.js pointArrowAt) points at the button, also after a resize
// - confirm box centred, at most 360px × 1.2; toast bottom centre; install banner across Home's width
// - below 1024px the popover is the phone one again (full width less the gutter, at most 780px)
const dt = require('./desktop-helpers');
const { assert } = dt;

const SCALE = 1.2;
const SETTINGS_W = 420 * SCALE;
const INFO_W = 560 * SCALE;
const MODAL_MAX_W = 360 * SCALE;
const PX_SLACK = 1.5;
const MODAL_ANIM_MS = 300; // css/components/modal.css .modal-backdrop.show slideIn 0.18s
const EXTRA_WIDE = { width: 1600, height: 900 };
const near = (a, b, slack = PX_SLACK) => Math.abs(a - b) <= slack;

// the open popover, its button, the header content box and where the arrow's centre is
const popGeometry = (page, popId, btnId) => page.evaluate(([p, bt]) => {
  const box = el => { const r = el.getBoundingClientRect(); return { left: r.left, right: r.right, top: r.top, bottom: r.bottom, width: r.width }; };
  const pop = byId(p), btn = byId(bt), after = getComputedStyle(pop, '::after');
  const popBox = box(pop);
  const probe = document.createElement('div');
  probe.style.paddingLeft = 'var(--space-5)';
  document.body.appendChild(probe);
  const gap = parseFloat(getComputedStyle(probe).paddingLeft);
  probe.remove();
  return { gap,
    shown: pop.classList.contains('show'), pop: popBox, btn: box(btn),
    // the content box (CUI-0031: .header-inner carries main's inline padding ≥ 1024px), where the logo and ⚙ sit
    inner: (() => { const el = document.querySelector('.header-inner'), b = box(el), cs = getComputedStyle(el);
      return { ...b, left: b.left + parseFloat(cs.paddingLeft), right: b.right - parseFloat(cs.paddingRight) }; })(),
    header: box(document.querySelector('header')),
    arrowX: popBox.left + parseFloat(after.left) + parseFloat(after.width) / 2, vw: document.documentElement.clientWidth, vh: innerHeight,
  };
}, [popId, btnId]);

function checkPop(g, kind, where) {
  const gap = g.gap;
  const centre = g.btn.left + g.btn.width / 2;
  assert(g.shown, `${where}: ${kind} popover open`);
  if (kind === 'settings') {
    assert(near(g.pop.width, SETTINGS_W) && near(g.pop.right, g.inner.right), `${where}: ⚙ popover ${g.pop.width}px (420 × 1.2), right edge on the header content (${g.pop.right.toFixed(1)} / ${g.inner.right.toFixed(1)})`);
  } else {
    assert(near(g.pop.width, INFO_W) && near(g.pop.left, g.inner.left), `${where}: ⓘ popover ${g.pop.width}px (560 × 1.2), left edge on the header content (${g.pop.left.toFixed(1)} / ${g.inner.left.toFixed(1)})`);
  }
  assert(near(g.pop.top, g.header.bottom + gap), `${where}: ${kind} popover --space-5 (${gap}px) under the header (${g.pop.top.toFixed(1)})`);
  assert(near(g.arrowX, centre), `${where}: ${kind} arrow points at its button (${g.arrowX.toFixed(1)} / ${centre.toFixed(1)})`);
  assert(g.pop.left >= 0 && g.pop.right <= g.vw && g.pop.bottom <= g.vh, `${where}: ${kind} popover inside the viewport`);
}

async function checkCase({ page, label, errors }) {
  await page.click('#settingsBtn');
  checkPop(await popGeometry(page, 'settingsPop', 'settingsBtn'), 'settings', label);
  assert((await dt.noHorizontalScroll(page)).ok, `${label}: ⚙ open, no sideways scroll`);
  await page.click('#infoBtn');
  const g = await popGeometry(page, 'infoPop', 'infoBtn');
  checkPop(g, 'info', label);
  assert(!(await page.$eval('#settingsPop', e => e.classList.contains('show'))), `${label}: one popover at a time`);
  await page.keyboard.press('Escape');
  assert(errors.length === 0, `${label}: no page error ${errors.join(' | ')}`);
}

// an open popover follows its button through a resize (1024 → 1280 → 1600 → 1024)
async function checkResize(b) {
  for (const [popId, btnId, kind] of [['settingsPop', 'settingsBtn', 'settings'], ['infoPop', 'infoBtn', 'info']]) {
    const { page } = await dt.openDesktop(b, { viewport: dt.VIEWPORTS.small });
    await page.click('#' + btnId);
    for (const viewport of [dt.VIEWPORTS.wide, EXTRA_WIDE, dt.VIEWPORTS.small]) {
      await dt.setViewport(page, viewport);
      checkPop(await popGeometry(page, popId, btnId), kind, `resized to ${viewport.width}px with ${kind} open`);
    }
    // below 1024px it is the phone popover again: the width less the 16px gutter, at most 780px
    await dt.setViewport(page, dt.VIEWPORTS.belowDesktop);
    const g = await popGeometry(page, popId, btnId);
    const gutter = await dt.measurePx(page, 'var(--space-8)');
    const want = Math.min(780, g.header.width - 2 * gutter);
    assert(near(g.pop.width, want) && near(g.pop.left, (g.header.width - want) / 2) && near(g.arrowX, g.btn.left + g.btn.width / 2),
      `1023px: ${kind} popover back to the phone one (${g.pop.width}px, want ${want}), arrow on its button`);
    await page.close();
  }
}

async function checkModalToastBanner(b) {
  for (const viewport of [dt.VIEWPORTS.small, dt.VIEWPORTS.wide]) {
    for (const lang of dt.LANGS) for (const fontSize of dt.FONT_SIZES) {
      const { page, label, errors } = await dt.openDesktop(b, { viewport, lang, fontSize });
      await page.evaluate(() => togglePlanFeature()); // the study plan is on by default: "turn it off?" (danger confirm)
      await page.waitForTimeout(MODAL_ANIM_MS); // slideIn moves the card 8px while it plays
      const m = await page.$eval('#confirmModal .modal-card', el => { const r = el.getBoundingClientRect(); return { left: r.left, right: r.right, top: r.top, bottom: r.bottom, width: r.width, vw: document.documentElement.clientWidth, vh: innerHeight }; });
      assert(near(m.width, MODAL_MAX_W) && near(m.left + m.width / 2, m.vw / 2) && near(m.top + (m.bottom - m.top) / 2, m.vh / 2),
        `${label}: confirm box ${m.width}px (360 × 1.2), centred`);
      assert(await page.evaluate(() => isConfirmOpen() && isStudyPlanEnabled()), `${label}: the confirm box is open, nothing changed yet`);
      await page.evaluate(() => closeConfirm());
      await page.evaluate(() => showToast(t('app.infoIntro', { n: 408 })));
      await page.waitForTimeout(MODAL_ANIM_MS); // toastIn 0.18s
      const tst = await page.$eval('#appToast', el => { const r = el.getBoundingClientRect(); return { cx: r.left + r.width / 2, bottom: r.bottom, left: r.left, right: r.right, vw: document.documentElement.clientWidth, vh: innerHeight }; });
      const space12 = await dt.measurePx(page, 'var(--space-12)');
      assert(near(tst.cx, tst.vw / 2) && near(tst.bottom, tst.vh - space12) && tst.left >= 0 && tst.right <= tst.vw,
        `${label}: toast bottom centre (${tst.cx.toFixed(1)} / ${tst.vw / 2}, bottom ${tst.bottom.toFixed(1)})`);
      await page.evaluate(() => byId('installBanner').classList.add('visible'));
      const ban = await page.evaluate(() => {
        const r = byId('installBanner').getBoundingClientRect(), h = byId('screenHome').getBoundingClientRect();
        return { left: r.left, width: r.width, homeLeft: h.left, homeW: h.width, top: r.top, first: byId('screenHome').firstElementChild.id };
      });
      assert(near(ban.width, ban.homeW) && near(ban.left, ban.homeLeft) && ban.first === 'installBanner', `${label}: install banner across Home's width, at its top (${ban.width.toFixed(1)} / ${ban.homeW.toFixed(1)})`);
      assert((await dt.noHorizontalScroll(page)).ok && errors.length === 0, `${label}: no sideways scroll, no page error`);
      await page.close();
    }
  }
}

(async () => {
  const b = await dt.launch();
  await dt.forEachCase(b, checkCase);
  await checkResize(b);
  await checkModalToastBanner(b);
  await b.close();
  console.log('DESKTOP-OVERLAYS PASS');
})().catch(e => { console.error(e.message || e); process.exit(1); });
