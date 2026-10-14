// ════════════════════════════════════════
// TELEMETRY — v2.7.0 anonymous usage counter (owner-only numbers, no UI).
// One beacon per page load to /api/track (api/track.js): open on every launch, standalone when it runs as the
// installed app, dau once per local day (TELEMETRY_DAY_LS), install on appinstalled (js/pwa/pwa.js).
// Sends no id or personal data. Only the Vercel production host reports (user decision 2026-10-14, option c);
// GitHub Pages, preview deploys and localhost send nothing. A failed send never affects the app.
// ════════════════════════════════════════
const isTelemetryHost = () => location.hostname === TELEMETRY_HOST;
const isStandaloneLaunch = () => window.matchMedia(STANDALONE_QUERY).matches || navigator.standalone === true;
const telemetryLocalIso = now => `${now.getFullYear()}-${pad2(now.getMonth() + 1)}-${pad2(now.getDate())}`;

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
  const today = telemetryLocalIso(now);
  const events = launchEvents({ today, lastDay: getLS(TELEMETRY_DAY_LS), standalone: isStandaloneLaunch() });
  if (sendTelemetry(events)) setLS(TELEMETRY_DAY_LS, today);
}

function reportInstall() {
  sendTelemetry([TELEMETRY_EVENTS.install]);
}
