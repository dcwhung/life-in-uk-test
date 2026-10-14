// ════════════════════════════════════════
// STATS PAGE — v2.9.0 owner dashboard (stats.html; mockup mockups/v2.9.0/stats-dashboard.html).
// Signs in with the STATS_USERNAME / STATS_PASSWORD set in Vercel, reads every day since launch once
// (GET /api/stats?days=all) and draws each range from that copy. The Basic header lives in sessionStorage only:
// closing the tab or Sign out forgets it. Numbers come from js/stats/statsModel.js, text from locales/stats.js.
// ════════════════════════════════════════
const STATS_ENDPOINT = '/api/stats?days=all';
const STATS_AUTH_SS = 'lifeuk.statsAuth';
const STATS_LANG_LS = 'lifeuk.statsLang';
const STATS_RANGE_LS = 'lifeuk.statsRange';
const STATS_DEFAULT_LANG = 'zh-HK';
const HTTP_UNAUTHORIZED = 401;
const HTTP_TOO_MANY = 429;
const SECONDS_PER_MINUTE = 60;
const COMPACT_FROM = 10000;
const COMPACT_WHOLE_FROM = 100000;
const THOUSAND = 1000;
// ISO date slices: 'YYYY-MM-DD'
const YEAR = [0, 4], YY = [2, 4], MONTH = [5, 7], DAY = [8, 10];
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const part = (iso, [from, to]) => iso.slice(from, to);
const RESIZE_DEBOUNCE_MS = 150;

const statsState = { lang: STATS_DEFAULT_LANG, range: STATS_DEFAULT_RANGE, data: null };
const byId = id => document.getElementById(id);
const tr = (key, params = {}) => STATS_STRINGS[statsState.lang][key].replace(/\{(\w+)\}/g, (_, k) => params[k]);
const readStore = (store, key) => { try { return store.getItem(key); } catch { return null; } };
const writeStore = (store, key, value) => { try { value === null ? store.removeItem(key) : store.setItem(key, value); } catch {} };

// ── formatting ──
const fmt = n => (n >= COMPACT_FROM ? (n / THOUSAND).toFixed(n >= COMPACT_WHOLE_FROM ? 0 : 1) + 'K' : Math.round(n).toLocaleString('en-GB'));
const pct = n => Math.round(n * STATS_PERCENT) + '%';
const monthParams = ym => ({ y: part(ym, YEAR), yy: part(ym, YY), m: Number(part(ym, MONTH)), mon: STATS_EN_MONTHS[Number(part(ym, MONTH)) - 1] });
const monthName = ym => tr('monthLong', monthParams(ym));
const monthShort = ym => tr('monthShort', monthParams(ym));
const isMonthKey = key => key.length === YEAR_MONTH_LENGTH;
const currentMonth = () => new Date().toISOString().slice(0, YEAR_MONTH_LENGTH);
const keyShort = key => (isMonthKey(key) ? monthShort(key) : `${Number(part(key, DAY))}/${Number(part(key, MONTH))}`);
// a part month says so, or its shorter bar reads as a drop: the running month "to date", the oldest one "from day n"
function keyLong(point) {
  if (!isMonthKey(point.key)) return point.key;
  if (point.key === currentMonth()) return monthName(point.key) + tr('toDate');
  return monthName(point.key) + (point.from ? tr('fromDay', { d: Number(part(point.from, DAY)) }) : '');
}

// ── text ──
function applyLang() {
  document.documentElement.lang = statsState.lang;
  document.title = tr('title');
  document.querySelectorAll('[data-i18n]').forEach(e => { e.textContent = tr(e.dataset.i18n); });
  document.querySelectorAll('[data-i18n-aria]').forEach(e => e.setAttribute('aria-label', tr(e.dataset.i18nAria)));
  document.querySelectorAll('.chip').forEach(c => {
    const r = c.dataset.range;
    c.textContent = r === STATS_ALL_RANGE ? tr('all') : r === '365' ? tr('year') : tr('days', { n: r });
  });
  byId('langBtn').textContent = tr('langBtn');
  byId('langBtn').setAttribute('aria-label', tr('langAria'));
}

// ── since launch (ignores the range) ──
function renderStrip(rows, launch) {
  byId('stripTitle').textContent = tr('since', { d: launch });
  byId('lOpen').textContent = fmt(sumOf(rows, 'open'));
  byId('lInstall').textContent = fmt(sumOf(rows, 'install'));
  byId('lShare').textContent = pct(appShare(rows));
  byId('lDays').textContent = fmt(rows.length);
}

// ── period tiles ──
function deltaHtml(diff, unit) {
  if (diff === null) return tr('noPrev');
  const cls = diff > 0 ? 'up' : diff < 0 ? 'down' : '';
  const span = statsState.range === '365' ? tr('vsPrevYear') : tr('vsPrevDays', { n: statsState.range });
  return `<span class="${cls}">${diff > 0 ? '+' : ''}${diff}${unit}</span> ${tr('vsPrev', { p: span })}`;
}
function renderTiles({ rows, prev }) {
  const hasPrev = prev.length > 0;
  const tile = (id, value, diff, unit = '%') => {
    byId('t' + id).textContent = value;
    byId('d' + id).innerHTML = deltaHtml(hasPrev ? diff : null, unit);
  };
  tile('Open', fmt(sumOf(rows, 'open')), changePct(sumOf(rows, 'open'), sumOf(prev, 'open')));
  tile('Dau', fmt(avgDau(rows)), changePct(avgDau(rows), avgDau(prev)));
  tile('Install', fmt(sumOf(rows, 'install')), changePct(sumOf(rows, 'install'), sumOf(prev, 'install')));
  tile('Share', pct(appShare(rows)), changePoints(appShare(rows), appShare(prev)), tr('points'));
  // all time: the since-launch strip already shows these numbers
  document.querySelector('.tiles').hidden = statsState.range === STATS_ALL_RANGE;
}

// ── charts: drawn at the card's pixel width, one scale per chart ──
const SVG_NS = 'http://www.w3.org/2000/svg';
const CHART_H = 220;
const CHART_MIN_W = 280;
const PAD = { l: 40, r: 40, t: 12, b: 28 };
const BAR_MAX = 24, BAR_MIN = 2, BAR_GAP = 2, BAR_RADIUS = 4;
const X_LABEL_SPACING = 64, X_LABEL_MIN = 3;
const TIP_EDGE = 80, TIP_TOP = 28, HOVER_OPACITY = 0.08;
const Y_LABEL_GAP = 8, X_LABEL_BASELINE = 8, TEXT_MIDLINE = 4, END_LABEL_GAP = 6;
function svgEl(tag, attrs, parent) {
  const e = document.createElementNS(SVG_NS, tag);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
  if (parent) parent.appendChild(e);
  return e;
}
function drawAxes(svg, scale, y, W) {
  for (let v = 0; v <= scale.max; v += scale.step) {
    svgEl('line', { x1: PAD.l, x2: W - PAD.r, y1: y(v), y2: y(v), stroke: 'var(--grid)', 'stroke-width': 1 }, svg);
    svgEl('text', { x: PAD.l - Y_LABEL_GAP, y: y(v) + TEXT_MIDLINE, 'text-anchor': 'end' }, svg).textContent = fmt(v);
  }
}
function frame(host, maxValue, points) {
  host.innerHTML = '';
  const W = Math.max(CHART_MIN_W, Math.round(host.clientWidth));
  const svg = svgEl('svg', { viewBox: `0 0 ${W} ${CHART_H}`, role: 'img' }, host);
  const scale = niceScale(maxValue);
  const plotW = W - PAD.l - PAD.r, plotH = CHART_H - PAD.t - PAD.b;
  const y = v => PAD.t + plotH - (v / scale.max) * plotH;
  drawAxes(svg, scale, y, W);
  const n = points.length, band = plotW / n;
  const x = i => PAD.l + band * i + band / 2;
  const every = Math.ceil(n / Math.max(X_LABEL_MIN, Math.floor(plotW / X_LABEL_SPACING)));
  points.forEach((p, i) => {
    if ((n - 1 - i) % every === 0) svgEl('text', { x: x(i), y: CHART_H - X_LABEL_BASELINE, 'text-anchor': 'middle' }, svg).textContent = keyShort(p.key);
  });
  return { svg, y, x, band, W, barW: Math.min(BAR_MAX, Math.max(BAR_MIN, band - BAR_GAP)) };
}
// a column part: 4px rounded top only on the bar's data end, square everywhere else
function column(svg, cx, w, top, bottom, fill, roundTop) {
  const h = bottom - top;
  if (h <= 0) return;
  const r = roundTop ? Math.min(BAR_RADIUS, w / 2, h) : 0;
  const l = cx - w / 2, rt = cx + w / 2;
  svgEl('path', { d: `M${l},${bottom} V${top + r} Q${l},${top} ${l + r},${top} H${rt - r} Q${rt},${top} ${rt},${top + r} V${bottom} Z`, fill }, svg);
}
function endLabel(f, points, value) {
  const i = points.length - 1;
  svgEl('text', { x: f.x(i) + f.barW / 2 + END_LABEL_GAP, y: f.y(value(points[i])) + TEXT_MIDLINE, class: 'end-label' }, f.svg).textContent = fmt(value(points[i]));
}
function attachHover(host, f, points, lines) {
  const tip = document.createElement('div');
  tip.className = 'tip'; tip.hidden = true; host.appendChild(tip);
  const hl = svgEl('rect', { y: PAD.t, height: CHART_H - PAD.t - PAD.b, fill: 'var(--text-muted)', opacity: 0 }, f.svg);
  points.forEach((p, i) => {
    const hit = svgEl('rect', { x: f.x(i) - f.band / 2, y: PAD.t, width: f.band, height: CHART_H - PAD.t - PAD.b, fill: 'transparent' }, f.svg);
    hit.addEventListener('pointerenter', () => {
      hl.setAttribute('x', f.x(i) - f.band / 2); hl.setAttribute('width', f.band); hl.setAttribute('opacity', HOVER_OPACITY);
      tip.innerHTML = `<b>${keyLong(p)}</b><br>` + lines.map(l =>
        `${l.color ? `<i style="background:${l.color}"></i>` : ''}${l.label} ${fmt(l.value(p))}`).join('<br>');
      tip.style.left = Math.min(Math.max(f.x(i), TIP_EDGE), f.W - TIP_EDGE) + 'px';
      tip.style.top = TIP_TOP + 'px';
      tip.hidden = false;
    });
    hit.addEventListener('pointerleave', () => { tip.hidden = true; hl.setAttribute('opacity', 0); });
  });
}
function renderDau(points, monthly) {
  const host = byId('dauChart');
  const f = frame(host, Math.max(...points.map(p => p.dau)), points);
  points.forEach((p, i) => column(f.svg, f.x(i), f.barW, f.y(p.dau), f.y(0), 'var(--series-1)', true));
  endLabel(f, points, p => p.dau);
  attachHover(host, f, points, [{ label: tr(monthly ? 'colDauMonthly' : 'colDauDaily'), color: 'var(--series-1)', value: p => p.dau }]);
}
// stacked: browser (bottom) + installed app (top), 2px surface gap between the two parts
function renderOpens(points) {
  const host = byId('openChart');
  const f = frame(host, Math.max(...points.map(p => p.open)), points);
  points.forEach((p, i) => {
    const split = f.y(p.open - p.standalone);
    column(f.svg, f.x(i), f.barW, split, f.y(0), 'var(--series-1)', p.standalone === 0);
    column(f.svg, f.x(i), f.barW, f.y(p.open), split - BAR_GAP, 'var(--series-2)', true);
  });
  endLabel(f, points, p => p.open);
  attachHover(host, f, points, [
    { label: tr('appOpens'), color: 'var(--series-2)', value: p => p.standalone },
    { label: tr('browserOpens'), color: 'var(--series-1)', value: p => p.open - p.standalone },
    { label: tr('total'), value: p => p.open },
  ]);
}

// ── table + headings ──
function renderTable(points) {
  byId('rows').innerHTML = points.map(p => {
    const cells = [p.open, p.open - p.standalone, p.standalone, p.dau, p.install];
    return `<tr><td>${keyLong(p)}</td>${cells.map(v => `<td class="${v ? '' : 'zero'}">${fmt(v)}</td>`).join('')}</tr>`;
  }).join('');
  byId('tablePanel').scrollTop = 0;
}
function renderHeadings(monthly) {
  const pick = (daily, perMonth) => tr(monthly ? perMonth : daily);
  byId('dauTitle').textContent = pick('dauDaily', 'dauMonthly');
  byId('dauSub').textContent = pick('dauSubDaily', 'dauSubMonthly');
  byId('openTitle').textContent = pick('openDaily', 'openMonthly');
  byId('tableTitle').textContent = pick('tableDaily', 'tableMonthly');
  byId('colPeriod').textContent = pick('colDay', 'colMonth');
  byId('colDau').textContent = pick('colDauDaily', 'colDauMonthly');
  byId('tablePanel').setAttribute('aria-label', pick('tableDaily', 'tableMonthly'));
}

function render() {
  const data = statsState.data;
  if (!data) return;
  const period = periodRows(data.days, statsState.range);
  const monthly = isMonthlyRange(statsState.range);
  const points = monthly ? toMonths(period.rows) : toDays(period.rows); // newest first
  renderStrip(data.days, data.launch);
  if (!points.length) return; // loadWith never hands over an empty list; nothing to chart if it ever did
  renderTiles(period);
  renderHeadings(monthly);
  const chrono = points.slice().reverse(); // charts read oldest → newest
  renderDau(chrono, monthly);
  renderOpens(chrono);
  renderTable(points);
}

// ── sign-in + loading ──
function showView(view) {
  byId('dash').hidden = view !== 'dash';
  byId('signin').hidden = view !== 'signin';
  byId('loading').hidden = view !== 'loading';
  document.querySelectorAll('.signed-in').forEach(e => { e.hidden = view === 'signin'; });
}
function errorText(res) {
  if (!res) return tr('errNetwork');
  if (res.status === HTTP_UNAUTHORIZED) return tr('errWrong');
  if (res.status === HTTP_TOO_MANY) {
    const minutes = Math.max(1, Math.ceil(Number(res.headers.get('Retry-After')) / SECONDS_PER_MINUTE) || 1);
    return tr('errLocked', { m: minutes });
  }
  return tr('errServer', { s: res.status });
}
// null = network failure; otherwise the Response
const fetchStats = auth => fetch(STATS_ENDPOINT, { headers: { Authorization: auth }, cache: 'no-store' }).catch(() => null);

async function loadWith(auth) {
  const res = await fetchStats(auth);
  if (!res || !res.ok) return { error: errorText(res), status: res && res.status };
  const data = await res.json().catch(() => null);
  if (!data || !ISO_DATE.test(data.launch) || !Array.isArray(data.days)) return { error: tr('errData') };
  // only well-formed days from launch on (S-281: the dates reach innerHTML)
  data.days = data.days.filter(d => d && ISO_DATE.test(d.date) && d.date >= data.launch);
  return data.days.length ? { data } : { error: tr('errData') };
}
function signOut() {
  writeStore(sessionStorage, STATS_AUTH_SS, null);
  statsState.data = null;
  byId('pwdInput').value = '';
  byId('signinError').textContent = '';
  showView('signin');
}
// W-386: with a dashboard on screen the message sits above it; with none (a reload) the sign-in view says why
function showLoadError(error) {
  if (statsState.data) {
    byId('loadError').textContent = error;
    byId('loadError').hidden = false;
    return;
  }
  byId('signinError').textContent = error;
  showView('signin');
}
async function refresh() {
  const auth = readStore(sessionStorage, STATS_AUTH_SS);
  if (!auth) return showView('signin');
  if (!statsState.data) showView('loading');
  const { data, error, status } = await loadWith(auth);
  if (status === HTTP_UNAUTHORIZED) { signOut(); byId('signinError').textContent = error; return; } // password changed in Vercel
  if (error) return showLoadError(error);
  byId('loadError').hidden = true;
  statsState.data = data;
  showView('dash');
  render();
}
async function onSignIn(e) {
  e.preventDefault();
  const btn = byId('signInBtn');
  const auth = basicAuthHeader(byId('userInput').value.trim(), byId('pwdInput').value);
  btn.disabled = true; btn.textContent = tr('signingIn');
  const { data, error } = await loadWith(auth);
  btn.disabled = false; btn.textContent = tr('signIn');
  if (error) { byId('signinError').textContent = error; return; }
  writeStore(sessionStorage, STATS_AUTH_SS, auth);
  byId('signinError').textContent = '';
  byId('pwdInput').value = '';
  statsState.data = data;
  showView('dash');
  render();
}

// ── controls ──
const pressRange = () => document.querySelectorAll('.chip').forEach(c => c.setAttribute('aria-pressed', String(c.dataset.range === statsState.range)));
function bindControls() {
  byId('rangeChips').addEventListener('click', e => {
    const btn = e.target.closest('.chip');
    if (!btn) return;
    statsState.range = btn.dataset.range;
    pressRange();
    writeStore(localStorage, STATS_RANGE_LS, statsState.range);
    render();
  });
  byId('langBtn').addEventListener('click', () => {
    statsState.lang = statsState.lang === 'en' ? STATS_DEFAULT_LANG : 'en';
    writeStore(localStorage, STATS_LANG_LS, statsState.lang);
    applyLang();
    render();
  });
  byId('refreshBtn').addEventListener('click', refresh);
  byId('signOutBtn').addEventListener('click', signOut);
  byId('signin').addEventListener('submit', onSignIn);
  let timer;
  window.addEventListener('resize', () => { clearTimeout(timer); timer = setTimeout(render, RESIZE_DEBOUNCE_MS); });
}

function startStats() {
  const savedRange = readStore(localStorage, STATS_RANGE_LS);
  if (STATS_RANGES.includes(savedRange)) statsState.range = savedRange;
  const savedLang = readStore(localStorage, STATS_LANG_LS);
  if (STATS_STRINGS[savedLang]) statsState.lang = savedLang;
  pressRange();
  applyLang();
  bindControls();
  refresh();
}
startStats();
