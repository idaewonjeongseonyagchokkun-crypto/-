// 앱 화면을 오프라인에서도 열 수 있게 정적 파일만 캐시합니다. API 요청은 캐시하지 않습니다.
// 경로는 서비스워커 위치 기준이라 루트(/)와 하위 경로(/-/) 배포 모두에서 동작합니다.
const CACHE = 'hankki-v2';
const BASE = new URL('./', self.location).pathname;
self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll([BASE, BASE + 'index.html', BASE + 'icon.svg', BASE + 'manifest.webmanifest'])));
  self.skipWaiting();
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))));
  self.clients.claim();
});
self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin || url.pathname.startsWith(BASE + 'api/')) return;
  e.respondWith(
    fetch(e.request)
      .then((res) => {
        if (res.ok) {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(e.request, copy));
        }
        return res;
      })
      .catch(() => caches.match(e.request).then((r) => r || caches.match(BASE + 'index.html')))
  );
});
