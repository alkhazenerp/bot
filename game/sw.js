// عامل خدمة بسيط: يخزن ملفات اللعبة ومكتبة three للعب دون اتصال
const CACHE = 'rada3-v1';
self.addEventListener('install', (e) => { self.skipWaiting(); });
self.addEventListener('activate', (e) => { e.waitUntil(self.clients.claim()); });
self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  const cacheable = url.origin === location.origin || url.host === 'cdn.jsdelivr.net' || url.host.endsWith('gstatic.com') || url.host === 'fonts.googleapis.com';
  if (!cacheable) return;
  e.respondWith(
    fetch(req).then((res) => {
      if (res.ok || res.type === 'opaque') { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy)); }
      return res;
    }).catch(() => caches.match(req)),
  );
});
