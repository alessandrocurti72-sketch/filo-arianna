// sw.js — Service Worker v4
// Il Filo di Arianna – Presenze PWA
const CACHE = 'filo-v4';

// Solo risorse statiche che non cambiano (icone e librerie esterne)
const CACHE_STATIC = [
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js'
];

// File dell'app: sempre rete, fallback cache se offline
const APP_FILES = ['/', '/index.html', '/app.js', '/sync.js', '/manifest.json'];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(CACHE_STATIC))
  );
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(ks =>
      Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', e => {
  const url = e.request.url;

  // Firebase/gstatic: sempre dalla rete, non intercettare
  if (url.includes('firestore.googleapis.com') ||
      url.includes('firebase') ||
      url.includes('gstatic.com') ||
      url.includes('bigdatacloud.net')) {
    return;
  }

  // File app (html, js): network-first, fallback cache
  const isAppFile = APP_FILES.some(f => url.endsWith(f) || url === location.origin + f);
  if (isAppFile) {
    e.respondWith(
      fetch(e.request)
        .then(res => {
          // Aggiorna la cache con la versione più recente
          const clone = res.clone();
          caches.open(CACHE).then(c => c.put(e.request, clone));
          return res;
        })
        .catch(() => caches.match(e.request))
    );
    return;
  }

  // Tutto il resto: cache-first
  e.respondWith(
    caches.match(e.request).then(r => r || fetch(e.request))
  );
});
