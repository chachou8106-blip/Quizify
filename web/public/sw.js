// Quizify service worker — v1
// Stratégie prudente : les pages et l'API vont TOUJOURS au réseau (pas de cache périmé),
// seuls les assets hashés (immutables) sont mis en cache.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));
self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (url.origin === location.origin && url.pathname.startsWith('/assets/')) {
    e.respondWith(
      caches.open('qzf-assets-v1').then(async (cache) => {
        const hit = await cache.match(e.request);
        if (hit) return hit;
        const res = await fetch(e.request);
        if (res.ok) cache.put(e.request, res.clone());
        return res;
      })
    );
  }
});
