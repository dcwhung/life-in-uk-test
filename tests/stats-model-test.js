// v2.9.0 owner dashboard (stats.html): the pure part, js/stats/statsModel.js. Node only: the file runs in a vm context
// (a classic script, as in the page). Rows are passed in, so no clock and no network.
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..');
let asserts = 0;
const assert = (c, m) => { if (!c) throw new Error('FAIL: ' + m); asserts++; console.log('ok:', m); };
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

const ctx = vm.createContext({ console, btoa: s => Buffer.from(s, 'binary').toString('base64'), TextEncoder });
vm.runInContext(fs.readFileSync(path.join(ROOT, 'js/stats/statsModel.js'), 'utf8'), ctx, { filename: 'statsModel.js' });
const g = code => vm.runInContext(code, ctx);
const call = (fn, ...args) => g(fn)(...args);

// 75 days: 2026-08-01 … 2026-10-14, newest first (as /api/stats returns); open = day number, standalone = 1, dau = 2
const DAY_MS = 86400000;
const START = Date.UTC(2026, 7, 1);
const COUNT = 75;
const ROWS = Array.from({ length: COUNT }, (_, i) => {
  const date = new Date(START + i * DAY_MS).toISOString().slice(0, 10);
  return { date, open: i + 1, standalone: 1, dau: 2 + (i % 2), install: i % 3 === 0 ? 1 : 0 };
}).reverse();

function checkPeriods() {
  const week = call('periodRows', ROWS, '7');
  assert(week.rows.length === 7 && week.rows[0].date === '2026-10-14' && week.prev.length === 7 && week.prev[0].date === '2026-10-07',
    '7: the last 7 days + the 7 before them');
  const ninety = call('periodRows', ROWS, '90');
  assert(ninety.rows.length === COUNT && ninety.prev.length === 0, '90 with 75 days of data: all 75, no previous period');
  // W-385: a previous period shorter than the range is no comparison (10 days of data, 7-day range → 3 earlier days)
  const short = call('periodRows', ROWS.slice(0, 10), '7');
  assert(short.rows.length === 7 && short.prev.length === 0, 'previous period only 3 of 7 days → no previous period');
  const all = call('periodRows', ROWS, 'all');
  assert(all.rows.length === COUNT && all.prev.length === 0, 'all: every day, no previous period');
  assert(call('isMonthlyRange', '365') && call('isMonthlyRange', 'all') && !call('isMonthlyRange', '90'), '1 year / all read per month; 90 per day');
}

function checkMonths() {
  const months = call('toMonths', ROWS);
  assert(same(months.map(m => m.key), ['2026-10', '2026-09', '2026-08']), 'months newest first');
  const aug = months[2];
  assert(aug.days === 31 && aug.open === (31 * 32) / 2 && aug.standalone === 31 && aug.install === 11,
    'August: 31 days summed (open 496, standalone 31, install 11)');
  assert(aug.dau === Math.round((16 * 2 + 15 * 3) / 31), 'August dau = rounded average of the daily counts');
  assert(months[0].days === 14, 'October so far: 14 days');
  // S-279: a month that starts after the 1st (launch month, the 1-year cut) carries its first date
  const cut = call('toMonths', ROWS.slice(0, 50));
  assert(cut[cut.length - 1].from === '2026-08-26' && months[2].from === null && months[0].from === null,
    'partial first month carries from; full or running months do not');
  const days = call('toDays', ROWS.slice(0, 2));
  assert(days[0].key === '2026-10-14' && days[0].open === ROWS[0].open, 'toDays keeps each day, key = date');
}

function checkSums() {
  const two = [{ open: 10, standalone: 4, dau: 3 }, { open: 0, standalone: 0, dau: 5 }];
  assert(call('sumOf', two, 'open') === 10 && call('avgDau', two) === 4, 'sum and average');
  assert(call('appShare', two) === 0.4 && call('appShare', []) === 0, 'installed-app share; 0 with no opens');
  assert(call('changePct', 12, 10) === 20 && call('changePct', 5, 0) === null, 'change %; null when the previous value is 0');
  assert(call('changePoints', 0.42, 0.39) === 3, 'change in percentage points');
}

function checkScale() {
  for (const [max, step, top] of [[54, 20, 60], [150, 50, 150], [0, 1, 4], [7, 2, 8], [4412, 2000, 6000]]) {
    const s = call('niceScale', max);
    assert(s.step === step && s.max === top, `niceScale(${max}) → step ${s.step}, top ${s.max}`);
  }
}

// HTTP Basic: base64 of the UTF-8 bytes, so a non-ASCII password still reaches the server intact
function checkBasic() {
  const header = call('basicAuthHeader', 'admin', 'pässwörd:1');
  const decoded = Buffer.from(header.replace('Basic ', ''), 'base64').toString('utf8');
  assert(header.startsWith('Basic ') && decoded === 'admin:pässwörd:1', 'Basic header round-trips UTF-8 and colons');
}

checkPeriods();
checkMonths();
checkSums();
checkScale();
checkBasic();
console.log(`PASS (${asserts} asserts)`);
