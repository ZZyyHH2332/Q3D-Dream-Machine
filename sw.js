// Service Worker for Q3D Dream Machine - Hunyuan3D Demo
// Caches the GLB model so repeat visits load instantly
const CACHE = 'q3d-hunyuan3d-v1';
const ASSETS = [
  'hunyuan3d-demo.html',
  'demo/hunyuan3d/output/model.glb',
  'demo/hunyuan3d/output/render.png',
  'demo/hunyuan3d/multiview/front.jpg',
  'demo/hunyuan3d/multiview/side.jpg',
  'demo/hunyuan3d/multiview/back.jpg',
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE).then((cache) => {
      // Cache non-streaming assets immediately
      const smallAssets = ASSETS.filter((a) => !a.endsWith('.glb'));
      return cache.addAll(smallAssets).catch(() => {});
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  // Only cache same-origin requests
  if (url.origin !== self.location.origin) return;
  // Skip importmap/three.js CDN requests
  if (url.hostname === 'unpkg.com') return;

  e.respondWith(
    caches.open(CACHE).then((cache) =>
      cache.match(e.request).then((cached) => {
        const fetchPromise = fetch(e.request).then((response) => {
          if (response.ok && response.status === 200) {
            cache.put(e.request, response.clone());
          }
          return response;
        });
        return cached || fetchPromise;
      })
    )
  );
});