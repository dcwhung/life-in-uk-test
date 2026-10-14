const { chromium } = require('playwright-core');
const fs = require('fs');
const path = require('path');
const { startPagesServer } = require('./pages-server');
// v2.9.0 owner dashboard (stats.html + js/stats/*): sign-in, errors, ranges, language, session, sign-out.
// The repo is served over http (python static server, read-only); /api/stats is answered by page.route, so no Vercel or
// Redis is needed. Fixture: 75 days ending today (UTC), so the running month is the real current month.
const ROOT = path.resolve(__dirname, '..');
const launchOpts = { args: ['--no-sandbox'] };
if (process.env.CHROMIUM_PATH) launchOpts.executablePath = process.env.CHROMIUM_PATH;
let asserts = 0;
const assert = (c, m) => { if (!c) throw new Error('FAIL: ' + m); asserts++; console.log('ok:', m); };

const USER = 'admin';
const PASSWORD = 'pässwörd:1';
const GOOD_AUTH = 'Basic ' + Buffer.from(`${USER}:${PASSWORD}`, 'utf8').toString('base64');
const DAY_MS = 86400000;
const DAYS = 75;
const TODAY_MS = Date.parse(new Date().toISOString().slice(0, 10));
const iso = ms => new Date(ms).toISOString().slice(0, 10);
const LAUNCH = iso(TODAY_MS - (DAYS - 1) * DAY_MS);
const CAPPED_AGO = [10, 40];
const FIXTURE = {
  launch: LAUNCH,
  days: [
    // SEC-01: days 10 and 40 back hit the request budget (none in the last 7 days, 1 in 30, 2 in 90)
    ...Array.from({ length: DAYS }, (_, i) => ({ date: iso(TODAY_MS - i * DAY_MS), open: 10 + i, standalone: 3, dau: 5, install: i % 5 === 0 ? 1 : 0, capped: CAPPED_AGO.includes(i) })),
    { date: iso(TODAY_MS - DAYS * DAY_MS), open: 999, standalone: 0, dau: 0, install: 0 }, // before launch: must be dropped
  ],
};
const TOTAL_OPENS = Array.from({ length: DAYS }, (_, i) => 10 + i).reduce((a, b) => a + b, 0);
const MONTHS = new Set(FIXTURE.days.slice(0, DAYS).map(d => d.date.slice(0, 7))).size;

// mode: 'ok' answers by the Authorization header; '429' / 'down' / 'abort' force that outcome
async function mockApi(page, state) {
  await page.route('**/api/stats**', route => {
    state.calls.push(route.request().headers().authorization || null);
    if (state.mode === 'abort') return route.abort();
    if (state.mode === '429') return route.fulfill({ status: 429, headers: { 'Retry-After': '1800' }, body: '' });
    if (state.mode === 'down') return route.fulfill({ status: 502, body: '' });
    if (route.request().headers().authorization !== GOOD_AUTH) return route.fulfill({ status: 401, body: '' });
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(FIXTURE) });
  });
}
const visible = (page, sel) => page.$eval(sel, e => !e.hidden && e.getClientRects().length > 0);
const text = (page, sel) => page.$eval(sel, e => e.textContent.trim());
async function signIn(page, password) {
  await page.fill('#userInput', USER);
  await page.fill('#pwdInput', password);
  await page.click('#signInBtn');
}

async function checkSignInErrors(page, state) {
  assert(await visible(page, '#signin') && !(await visible(page, '#rangeChips')), 'no session: sign-in form, no range chips');
  assert(state.calls.length === 0, 'no session: /api/stats not called');
  // QA S-2: a username of only spaces is not sent (it would spend one of the hour's attempts)
  await page.fill('#userInput', '   ');
  await page.fill('#pwdInput', PASSWORD);
  await page.click('#signInBtn');
  assert(state.calls.length === 0 && (await text(page, '#signinError')) === '請輸入帳號', 'blank username: not sent, asks for the username');
  await signIn(page, 'wrong');
  await page.waitForFunction(() => document.getElementById('signinError').textContent);
  assert((await text(page, '#signinError')) === '帳號或密碼唔啱，請再試一次', 'wrong password → 帳號或密碼唔啱');
  state.mode = '429';
  await signIn(page, PASSWORD);
  await page.waitForFunction(() => document.getElementById('signinError').textContent.includes('分鐘'));
  assert((await text(page, '#signinError')).includes('30 分鐘'), '429 Retry-After 1800 → 30 分鐘後再試');
  state.mode = 'abort';
  await signIn(page, PASSWORD);
  await page.waitForFunction(() => document.getElementById('signinError').textContent.includes('連唔到'));
  assert(await page.evaluate(() => sessionStorage.getItem('lifeuk.statsAuth')) === null, 'failed sign-ins store nothing');
  state.mode = 'ok';
}

async function checkDashboard(page, state) {
  await signIn(page, PASSWORD);
  await page.waitForSelector('#dash:not([hidden])');
  assert(state.calls[state.calls.length - 1] === GOOD_AUTH, 'Basic header = UTF-8 username:password (colon in password kept)');
  assert(await page.evaluate(() => sessionStorage.getItem('lifeuk.statsAuth')) === GOOD_AUTH && (await page.inputValue('#pwdInput')) === '',
    'session keeps the header; the password field is cleared');
  assert((await text(page, '#lDays')) === String(DAYS) && (await text(page, '#lOpen')) === TOTAL_OPENS.toLocaleString('en-GB'),
    `since launch: ${DAYS} days, pre-launch row dropped`);
  assert((await page.$$('#rows tr')).length === 30 && (await text(page, '#tableTitle')) === '每日明細', 'default 30 days: 30 daily rows');
  assert((await page.$$('#openChart path')).length === 60 && (await page.$$('#dauChart path')).length === 30, 'charts: 30 stacked bars, 30 dau bars');
  assert((await text(page, '#dOpen')).includes('對比之前 30 日'), 'tiles compare with the previous 30 days');
  await page.click('.chip[data-range="all"]');
  assert((await page.$$('#rows tr')).length === MONTHS && (await text(page, '#tableTitle')) === '每月明細', `all: ${MONTHS} monthly rows`);
  assert(!(await visible(page, '.tiles')), 'all: tiles hidden (the strip has the same numbers)');
  assert((await text(page, '#rows tr:first-child td:first-child')).endsWith('（至今）'), 'the running month is marked 至今');
  const firstMonth = await text(page, '#rows tr:last-child td:first-child');
  assert(LAUNCH.endsWith('-01') || firstMonth.includes(`由 ${Number(LAUNCH.slice(8))} 日起`), `the launch month is marked 由 n 日起 (${firstMonth})`);
  await page.click('.chip[data-range="7"]');
  assert((await text(page, '#dOpen')).includes('對比之前 7 日') && await visible(page, '.tiles'), '7 days: tiles back, vs previous 7 days');
}

// SEC-01: a range holding days that hit the daily request budget says so, in the existing note style (.load-error)
async function checkCappedNote(page) {
  await page.click('.chip[data-range="30"]');
  assert(await visible(page, '#cappedNote') && (await text(page, '#cappedNote')).includes('1 日'), '30 days: 1 capped day → note shown');
  // S-302 + live region: role=status sits on an always-present wrapper (no class), so the note's text is announced
  // when it appears; a live region that is itself hidden then shown may not be announced
  assert(await page.$eval('#cappedLive', e => e.getAttribute('role') === 'status' && e.className === '' && !e.hidden &&
    !!e.querySelector(':scope > .load-error#cappedNote')), 'S-302: #cappedLive[role=status] (no class, never hidden) wraps .load-error#cappedNote');
  assert(await page.$eval('#cappedNote', e => e.className === 'load-error' && !e.hasAttribute('role')), 'S-302: the note itself reuses .load-error and has no role');
  await page.click('.chip[data-range="90"]');
  assert((await text(page, '#cappedNote')).includes('2 日'), '90 days: 2 capped days');
  await page.click('#langBtn');
  assert((await text(page, '#cappedNote')).includes('daily request limit was reached on 2 days'), 'EN note text');
  await page.click('#langBtn');
  await page.click('.chip[data-range="7"]');
  assert(!(await visible(page, '#cappedNote')), '7 days: no capped day → no note');
}

async function checkLanguageAndSession(page) {
  await page.click('#langBtn');
  assert((await text(page, '#tableTitle')) === 'Daily breakdown' && (await text(page, '#langBtn')) === '中', 'EN: table title + 中 button');
  await page.hover('#openChart svg', { position: { x: 300, y: 120 } });
  assert((await text(page, '#openChart .tip')).includes('Total'), 'hover tooltip in English with a Total line');
  await page.reload();
  await page.waitForSelector('#dash:not([hidden])');
  assert((await text(page, '#tableTitle')) === 'Daily breakdown' && (await page.$$('#rows tr')).length === 7, 'reload: still signed in, EN + 7 days remembered');
  await page.click('#signOutBtn');
  assert(await visible(page, '#signin') && await page.evaluate(() => sessionStorage.getItem('lifeuk.statsAuth')) === null, 'sign out: form back, session cleared');
}

// a password changed in Vercel while signed in: refresh gets 401 → back to the form with the message
async function checkStaleSession(page, state) {
  await signIn(page, PASSWORD);
  await page.waitForSelector('#dash:not([hidden])');
  await page.evaluate(() => sessionStorage.setItem('lifeuk.statsAuth', 'Basic c3RhbGU6c3RhbGU='));
  await page.click('#refreshBtn');
  await page.waitForSelector('#signin:not([hidden])');
  assert((await text(page, '#signinError')).startsWith('Wrong username'), 'stale session → sign-in with the wrong-password message');
  state.mode = 'down';
  await signIn(page, PASSWORD);
  await page.waitForFunction(() => document.getElementById('signinError').textContent.includes('502'));
  assert(true, '502 → server error message with the status');
  state.mode = 'ok';
}

// W-386: signed in, then a reload meets 429 / 502 / no network: the sign-in view says why
async function checkReloadErrors(browser, base) {
  const page = await browser.newPage({ viewport: { width: 1100, height: 900 } });
  const state = { mode: 'ok', calls: [] };
  await mockApi(page, state);
  await page.goto(base + 'stats.html');
  await signIn(page, PASSWORD);
  await page.waitForSelector('#dash:not([hidden])');
  for (const [mode, expected] of [['429', '30 分鐘'], ['down', '502'], ['abort', '連唔到']]) {
    state.mode = mode;
    await page.reload();
    await page.waitForSelector('#signin:not([hidden])');
    await page.waitForFunction(t => document.getElementById('signinError').textContent.includes(t), expected);
    assert(true, `reload with a session + ${mode} → sign-in view shows "${expected}"`);
  }
  state.mode = 'ok';
  await page.reload();
  await page.waitForSelector('#dash:not([hidden])');
  assert(true, 'the kept session loads again once the API is back');
  await page.close();
}

async function checkPhone(browser, base) {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const state = { mode: 'ok', calls: [] };
  await mockApi(page, state);
  await page.goto(base + 'stats.html');
  await signIn(page, PASSWORD);
  await page.waitForSelector('#dash:not([hidden])');
  const layout = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, panel: getComputedStyle(document.getElementById('tablePanel')).overflowY,
    font: getComputedStyle(document.querySelector('#dauChart text')).fontSize }));
  assert(layout.sw <= 390 && layout.panel === 'auto' && layout.font === '11px', 'phone: no sideways scroll, table panel scrolls, chart text 11px');
  await page.close();
}

function checkStatic() {
  const sw = fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8');
  assert(!sw.includes('stats') && !fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8').includes('stats.html'),
    'stats.html is not in the SW shell and not linked from the app');
  const html = fs.readFileSync(path.join(ROOT, 'stats.html'), 'utf8');
  assert(html.includes('<meta name="robots" content="noindex, nofollow">'), 'stats.html is noindex');
  // S-280: the page runs under a CSP (meta here, so this suite runs under it too) and Vercel adds frame-ancestors
  assert(/<meta http-equiv="Content-Security-Policy" content="default-src 'self'[^"]*script-src 'self'/.test(html), 'stats.html carries a self-only CSP');
  const vercel = JSON.parse(fs.readFileSync(path.join(ROOT, 'vercel.json'), 'utf8'));
  const rule = vercel.headers.find(h => h.source === '/stats.html');
  const headerCsp = rule && (rule.headers.find(h => h.key === 'Content-Security-Policy') || {}).value;
  assert(headerCsp && headerCsp.includes("frame-ancestors 'none'"), "vercel.json: /stats.html gets frame-ancestors 'none'");
  // S-288: one policy in two places; the browser enforces both, so a drift breaks the page quietly
  const metaCsp = html.match(/<meta http-equiv="Content-Security-Policy" content="([^"]+)">/)[1];
  assert(headerCsp.replace(/; frame-ancestors 'none'/, '') === metaCsp, 'meta CSP = vercel.json CSP minus frame-ancestors');
}

(async () => {
  checkStatic();
  const { base, server } = await startPagesServer(ROOT);
  const browser = await chromium.launch(launchOpts);
  try {
    const page = await browser.newPage({ viewport: { width: 1100, height: 900 } });
    const errs = []; page.on('pageerror', e => errs.push(e.message));
    const state = { mode: 'ok', calls: [] };
    await mockApi(page, state);
    await page.goto(base + 'stats.html');
    await checkSignInErrors(page, state);
    await checkDashboard(page, state);
    await checkCappedNote(page);
    await checkLanguageAndSession(page);
    await checkStaleSession(page, state);
    assert(errs.length === 0, 'no page errors: ' + errs.join(' | '));
    await checkReloadErrors(browser, base);
    await checkPhone(browser, base);
    console.log(`STATS PAGE PASS (${asserts} asserts)`);
  } finally {
    await browser.close();
    server.kill();
  }
})().catch(e => { console.error(e.message); process.exit(1); });
