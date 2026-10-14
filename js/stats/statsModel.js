// ════════════════════════════════════════
// STATS MODEL — v2.9.0 owner dashboard (stats.html): pure functions over the /api/stats rows, no DOM and no clock.
// Rows are daily { date, open, standalone, dau, install }, newest first, launch day onward (api/stats.js).
// 7 / 30 / 90 days read per day; 1 year / all time read per month (user decision 2026-10-14).
// ════════════════════════════════════════
const STATS_RANGES = ['7', '30', '90', '365', 'all'];
const STATS_ALL_RANGE = 'all';
const STATS_MONTHLY_RANGES = ['365', STATS_ALL_RANGE];
const STATS_DEFAULT_RANGE = '30';
const STATS_TICKS = 4;
const STATS_TICK_STEPS = [1, 2, 5, 10];
const STATS_PERCENT = 100;
const YEAR_MONTH_LENGTH = 7; // '2026-10'

const isMonthlyRange = range => STATS_MONTHLY_RANGES.includes(range);

// the chosen span (newest first) and the same span just before it, for the "vs previous" deltas
function periodRows(rows, range) {
  if (range === STATS_ALL_RANGE) return { rows, prev: [] };
  const n = Number(range);
  return { rows: rows.slice(0, n), prev: rows.slice(n, n * 2) };
}

const sumOf = (rows, key) => rows.reduce((n, r) => n + r[key], 0);
const avgDau = rows => (rows.length ? sumOf(rows, 'dau') / rows.length : 0);
const appShare = rows => (sumOf(rows, 'open') ? sumOf(rows, 'standalone') / sumOf(rows, 'open') : 0);
// whole-percent change; null when there is nothing to compare with
const changePct = (cur, prev) => (prev ? Math.round(((cur - prev) / prev) * STATS_PERCENT) : null);
const changePoints = (cur, prev) => Math.round((cur - prev) * STATS_PERCENT);

// one row per calendar month, newest first; dau becomes the month's average daily count (no unique devices per month:
// no device id is stored)
function toMonths(rows) {
  const byMonth = new Map();
  for (const r of rows) {
    const ym = r.date.slice(0, YEAR_MONTH_LENGTH);
    if (!byMonth.has(ym)) byMonth.set(ym, []);
    byMonth.get(ym).push(r);
  }
  return [...byMonth].map(([ym, days]) => ({
    key: ym, open: sumOf(days, 'open'), standalone: sumOf(days, 'standalone'),
    dau: Math.round(avgDau(days)), install: sumOf(days, 'install'), days: days.length,
  }));
}
const toDays = rows => rows.map(r => ({ key: r.date, ...r }));

// clean axis: step = 1 / 2 / 5 × 10^k, top = the first step multiple at or above the data (at least STATS_TICKS)
function niceScale(maxValue) {
  const top = Math.max(maxValue, STATS_TICKS);
  const raw = top / STATS_TICKS;
  const mag = Math.pow(10, Math.floor(Math.log10(raw)));
  const step = STATS_TICK_STEPS.map(m => m * mag).find(m => m >= raw);
  return { step, max: Math.ceil(top / step) * step };
}

// HTTP Basic over the UTF-8 bytes (btoa alone only takes Latin-1)
function basicAuthHeader(user, password) {
  const bytes = new TextEncoder().encode(`${user}:${password}`);
  return 'Basic ' + btoa(String.fromCharCode(...bytes));
}
