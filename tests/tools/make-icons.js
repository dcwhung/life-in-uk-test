// Regenerate the PNG app icons from icons/icon.svg (run after editing the SVG, then commit the PNGs).
//   NODE_PATH=/opt/node-tools/node_modules CHROMIUM_PATH=/opt/pw-browsers/chromium node tests/tools/make-icons.js
// Chromium renders the SVG at each exact size, so the PNGs match what browsers draw for the SVG favicon.
const { chromium } = require('playwright-core');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');
const ICON_DIR = path.join(ROOT, 'icons');
// full-bleed fill behind the artwork: the light base colour of icon.svg, so the edges blend into the artwork
const ICON_BASE = '#eaf2fa';
// maskable icons get cropped to a circle of 80% of the width: shrink the artwork into that safe zone
const MASKABLE_SAFE_SCALE = 0.8;
const FULL_SCALE = 1;
const TRANSPARENT = 'transparent';

// "any" icons keep the SVG's rounded corners; apple-touch (iOS rounds it itself) and maskable are full-bleed ICON_BASE
const VARIANTS = [
  { file: 'icon-192.png', size: 192, scale: FULL_SCALE, background: TRANSPARENT },
  { file: 'icon-512.png', size: 512, scale: FULL_SCALE, background: TRANSPARENT },
  { file: 'icon-maskable-512.png', size: 512, scale: MASKABLE_SAFE_SCALE, background: ICON_BASE },
  { file: 'apple-touch-icon.png', size: 180, scale: FULL_SCALE, background: ICON_BASE },
];

function pageHtml(svgDataUri, { size, scale, background }) {
  const art = Math.round(size * scale);
  return `<html><body style="margin:0;width:${size}px;height:${size}px;background:${background};display:grid;place-items:center">`
    + `<img src="${svgDataUri}" width="${art}" height="${art}"></body></html>`;
}

(async () => {
  const svg = fs.readFileSync(path.join(ICON_DIR, 'icon.svg'));
  const svgDataUri = 'data:image/svg+xml;base64,' + svg.toString('base64');
  const launchOpts = { args: ['--no-sandbox'] };
  if (process.env.CHROMIUM_PATH) launchOpts.executablePath = process.env.CHROMIUM_PATH;
  const b = await chromium.launch(launchOpts);
  try {
    for (const v of VARIANTS) {
      const pg = await b.newPage({ viewport: { width: v.size, height: v.size }, deviceScaleFactor: 1 });
      await pg.setContent(pageHtml(svgDataUri, v));
      await pg.waitForFunction(() => document.images[0].complete && document.fonts.status === 'loaded');
      if (!(await pg.evaluate(() => document.images[0].naturalWidth))) throw new Error('icons/icon.svg did not decode');
      await pg.screenshot({ path: path.join(ICON_DIR, v.file), omitBackground: v.background === TRANSPARENT });
      await pg.close();
      console.log(`wrote icons/${v.file} (${v.size}x${v.size})`);
    }
  } finally {
    await b.close();
  }
})().catch(e => { console.error(e.message); process.exit(1); });
