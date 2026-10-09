// ════════════════════════════════════════
// SERVICE WORKER — cache-first app shell for offline use.
// Lives at the site root because a worker only controls pages at or below its own path.
// Cache name follows APP_VERSION (js/core/config.js): bump the version and installed apps refresh.
// Every file index.html loads must be in SHELL (tests/sw-test.js checks this).
// ════════════════════════════════════════
importScripts('js/core/config.js');

// the origin (dcwhung.github.io) is shared with other apps: only ever touch our own caches
const CACHE_PREFIX = 'lifeuk-v';
const CACHE = CACHE_PREFIX + APP_VERSION;
const SHELL = [
  './',
  'index.html',
  'icons/icon.svg',
  'icons/icon-192.png',
  'icons/apple-touch-icon.png',
  'icons/icon-512.png',
  'icons/icon-maskable-512.png',
  'manifest.webmanifest',
  'data/exams.js',
  'data/study.js',
  'css/base/tokens.css',
  'css/base/layout.css',
  'css/components/buttons.css',
  'css/components/chips.css',
  'css/components/dots.css',
  'css/components/modal.css',
  'css/components/note.css',
  'css/components/popover.css',
  'css/components/fact.css',
  'css/components/switch.css',
  'css/components/toast.css',
  'css/screens/home.css',
  'css/screens/quiz.css',
  'css/screens/results.css',
  'css/screens/flagged.css',
  'css/screens/study.css',
  'css/screens/plan.css',
  'js/core/config.js',
  'js/core/utils.js',
  'locales/en.js',
  'locales/zh-HK.js',
  'js/core/i18n.js',
  'js/core/store.js',
  'js/domain/questions.js',
  'js/domain/mastery.js',
  'js/domain/similar.js',
  'js/domain/plan.js',
  'js/domain/planProgress.js',
  'js/components/icons.js',
  'js/components/dots.js',
  'js/components/tags.js',
  'js/components/modal.js',
  'js/components/popover.js',
  'js/components/factCard.js',
  'js/components/switch.js',
  'js/components/toast.js',
  'js/screens/home.js',
  'js/screens/quiz.js',
  'js/screens/examTools.js',
  'js/screens/sideSession.js',
  'js/screens/similarPanel.js',
  'js/screens/result.js',
  'js/screens/flagged.js',
  'js/screens/study.js',
  'js/screens/planHome.js',
  'js/screens/planGoal.js',
  'js/screens/planSchedule.js',
  'js/screens/planDay.js',
  'js/screens/planRun.js',
  'js/core/actions.js',
  'js/pwa/pwa.js',
  'js/main.js',
];

self.addEventListener('install', e => {
  // cache: 'reload' skips the HTTP cache (GitHub Pages sends max-age=600), so a new version never stores stale files
  const requests = SHELL.map(u => new Request(u, { cache: 'reload' }));
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(requests)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys =>
    Promise.all(keys.filter(k => k.startsWith(CACHE_PREFIX) && k !== CACHE).map(k => caches.delete(k)))
  ).then(() => self.clients.claim()));
});
// caches.match() would search every cache on the shared origin, other apps' too (S-003): read only our own
const fromOwnCache = request => caches.open(CACHE).then(c => c.match(request));
// offline fallback to the app page only for page loads; a missing script / image just fails
const offlineFallback = request => (request.mode === 'navigate' ? fromOwnCache('./') : Response.error());
self.addEventListener('fetch', e => {
  e.respondWith(fromOwnCache(e.request).then(r => r || fetch(e.request).catch(() => offlineFallback(e.request))));
});
