const CACHE_NAME = 'mi-semestre-v1';
const PRECACHE_ASSETS = [
  '/',
  '/index.html',
  '/manifest.webmanifest',
  '/icon-192.png',
  '/icon-512.png',
  'https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;600;700&family=IBM+Plex+Sans:wght@400;500;600&family=IBM+Plex+Mono:wght@400;500;600&display=swap'
];

// Instalar Service Worker y realizar precarga
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(PRECACHE_ASSETS).catch((err) => {
        console.warn('[SW] Precarga parcial omitida:', err);
      });
    }).then(() => self.skipWaiting())
  );
});

// Activar Service Worker y limpiar cachés obsoletas
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Estrategia Network-First agresiva: Red primero, Caché como respaldo offline
self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = new URL(req.url);

  // Ignorar peticiones no GET, esquemas no HTTP (ej. chrome-extension://) y rutas API de backend/backup
  if (req.method !== 'GET' || !url.protocol.startsWith('http') || url.pathname.startsWith('/api/')) {
    return;
  }

  event.respondWith(
    fetch(req)
      .then((networkResponse) => {
        // Red respondió con éxito -> Actualizar caché local en segundo plano y devolver red
        if (networkResponse && (networkResponse.status === 200 || networkResponse.type === 'opaque')) {
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(req, responseToCache);
          });
        }
        return networkResponse;
      })
      .catch(async () => {
        // Red falló (Offline / Sin conexión) -> Intentar devolver desde caché local
        const cachedResponse = await caches.match(req);
        if (cachedResponse) {
          return cachedResponse;
        }

        // Si es una navegación principal HTML y no está en caché explícita, devolver index.html
        if (req.mode === 'navigate' || (req.headers.get('accept') && req.headers.get('accept').includes('text/html'))) {
          return caches.match('/index.html') || caches.match('/');
        }

        return new Response('Sin conexión a Internet', {
          status: 503,
          statusText: 'Service Unavailable',
          headers: new Headers({ 'Content-Type': 'text/plain; charset=utf-8' })
        });
      })
  );
});
