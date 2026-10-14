// ════════════════════════════════════════
// TELEMETRY — v2.8.0 anonymous usage counter (owner-only numbers, no UI).
// One beacon per page load to /api/track (api/track.js): open on every launch, standalone when it runs as the
// installed app, dau once per UTC day (TELEMETRY_DAY_LS), install on appinstalled (js/pwa/pwa.js).
// Sends no id or personal data. Only the Vercel production host reports (user decision 2026-10-14, option c);
// GitHub Pages, preview deploys and localhost send nothing. A failed send never affects the app.
// ════════════════════════════════════════
// W-057: a cached pre-v2.8.0 config.js has none of the TELEMETRY_* constants (they shipped together): stay silent
const isTelemetryConfigured = () => typeof TELEMETRY_DAY_LS !== 'undefined';
const isTelemetryHost = () => location.hostname === TELEMETRY_HOST;
const isStandaloneLaunch = () => window.matchMedia(STANDALONE_QUERY).matches || navigator.standalone === true;
// W-089: the UTC day, the same bucket api/track.js files the counts under, so dau = distinct devices per stored date
const telemetryUtcIso = now => `${now.getUTCFullYear()}-${pad2(now.getUTCMonth() + 1)}-${pad2(now.getUTCDate())}`;

// the events one launch reports: pure, so the rule is testable without a browser
function launchEvents({ today, lastDay, standalone }) {
  const events = [TELEMETRY_EVENTS.open];
  if (standalone) events.push(TELEMETRY_EVENTS.standalone);
  if (today !== lastDay) events.push(TELEMETRY_EVENTS.dau);
  return events;
}

// true only when the browser queued the beacon; offline or no sendBeacon = not sent
function sendTelemetry(events) {
  if (!isTelemetryHost() || navigator.onLine === false || typeof navigator.sendBeacon !== 'function') return false;
  try {
    return navigator.sendBeacon(TELEMETRY_ENDPOINT, JSON.stringify({ events }));
  } catch {
    return false;
  }
}

// a day is marked only after its beacon was queued, so an offline launch still counts on the next online one
function reportLaunch(now = new Date()) {
  if (!isTelemetryConfigured()) return;
  const today = telemetryUtcIso(now);
  const events = launchEvents({ today, lastDay: getLS(TELEMETRY_DAY_LS), standalone: isStandaloneLaunch() });
  if (sendTelemetry(events)) setLS(TELEMETRY_DAY_LS, today);
}

function reportInstall() {
  if (!isTelemetryConfigured()) return;
  sendTelemetry([TELEMETRY_EVENTS.install]);
}

// v2.10.0: Vercel Web Analytics, same host gate as the counter. Injected here instead of a <script> tag in index.html:
// the script exists only on Vercel, and every tag index.html loads must be in the SW shell (tests/sw-test.js), which
// would then fail to install on GitHub Pages. window.va queues calls until the script has loaded (Vercel's snippet)
function loadVercelAnalytics() {
  if (!isTelemetryConfigured() || typeof VERCEL_ANALYTICS_SRC === 'undefined' || !isTelemetryHost()) return;
  if (document.querySelector(`script[src="${VERCEL_ANALYTICS_SRC}"]`)) return;
  window.va = window.va || function () { (window.vaq = window.vaq || []).push(arguments); };
  const script = document.createElement('script');
  script.defer = true;
  script.src = VERCEL_ANALYTICS_SRC;
  document.head.appendChild(script);
}
