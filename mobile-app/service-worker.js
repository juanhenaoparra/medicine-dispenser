/**
 * Service Worker para PWA del Dispensador
 * 
 * Proporciona funcionalidad offline básica y cache de assets estáticos
 */

const CACHE_NAME = 'dispenser-v1';
const ASSETS_TO_CACHE = [
  '/dispenser-client.html',
  '/manifest.json'
];

// Instalación - cachear assets
self.addEventListener('install', (event) => {
  console.log('Service Worker: Installing...');
  
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('Service Worker: Caching assets');
        return cache.addAll(ASSETS_TO_CACHE);
      })
      .then(() => self.skipWaiting())
  );
});

// Activación - limpiar caches antiguos
self.addEventListener('activate', (event) => {
  console.log('Service Worker: Activating...');
  
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log('Service Worker: Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch - estrategia Network First con fallback a Cache
self.addEventListener('fetch', (event) => {
  // Solo cachear requests GET
  if (event.request.method !== 'GET') {
    return;
  }

  // No cachear llamadas al API
  if (event.request.url.includes('/api/')) {
    return;
  }

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // Clonar la respuesta porque solo puede ser consumida una vez
        const responseToCache = response.clone();
        
        caches.open(CACHE_NAME).then((cache) => {
          cache.put(event.request, responseToCache);
        });
        
        return response;
      })
      .catch(() => {
        // Si falla el fetch, intentar obtener del cache
        return caches.match(event.request)
          .then((response) => {
            if (response) {
              return response;
            }
            
            // Si no está en cache, retornar página offline básica
            return new Response(
              '<html><body><h1>Sin conexión</h1><p>Por favor verifica tu conexión a internet.</p></body></html>',
              { headers: { 'Content-Type': 'text/html' } }
            );
          });
      })
  );
});

// Manejar mensajes desde la app
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

