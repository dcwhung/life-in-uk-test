// ════════════════════════════════════════
// SERVICE WORKER — cache-first app shell for offline use.
// Lives at the site root because a worker only controls pages at or below its own path.
// Cache name follows APP_VERSION (js/core/config.js): bump the version and installed apps refresh.
// Every file index.html loads must be in SHELL (tests/sw-test.js checks this).
// ════════════════════════════════════════
importScripts('js/core/config.js');

const CACHE = 'lifeuk-v' + APP_VERSION;
const SHELL = [
  './',
  'index.html',
  'data/exams.js',
  'data/study.js',
  'css/base/tokens.css',
  'css/base/layout.css',
  'css/components/buttons.css',
  'css/components/chips.css',
  'css/components/dots.css',
  'css/components/modal.css',
  'css/components/popover.css',
  'css/screens/home.css',
  'css/screens/quiz.css',
  'css/screens/results.css',
  'css/screens/flagged.css',
  'css/screens/study.css',
  'js/core/config.js',
  'js/core/utils.js',
  'js/core/store.js',
  'js/domain/questions.js',
  'js/domain/mastery.js',
  'js/domain/similar.js',
  'js/components/icons.js',
  'js/components/dots.js',
  'js/components/tags.js',
  'js/components/modal.js',
  'js/components/popover.js',
  'js/screens/home.js',
  'js/screens/quiz.js',
  'js/screens/examTools.js',
  'js/screens/similarPanel.js',
  'js/screens/result.js',
  'js/screens/flagged.js',
  'js/screens/study.js',
  'js/core/actions.js',
  'js/pwa/pwa.js',
  'js/main.js',
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys =>
    Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
  ).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  e.respondWith(caches.match(e.request).then(r => r || fetch(e.request).catch(() => caches.match('./'))));
});
