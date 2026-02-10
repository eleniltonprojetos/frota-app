const CACHE_NAME = 'frota-app-v1';
const DATA_CACHE_NAME = 'frota-data-v1';

// Arquivos essenciais para instalar imediatamente
const FILES_TO_CACHE = [
  '/',
  '/index.html',
  '/manifest.json'
];

// 1. Instalação do Service Worker
self.addEventListener('install', (evt) => {
  console.log('[ServiceWorker] Instalando');
  evt.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[ServiceWorker] Fazendo cache dos arquivos estáticos');
      return cache.addAll(FILES_TO_CACHE);
    })
  );
  self.skipWaiting();
});

// 2. Ativação (Limpar caches antigos)
self.addEventListener('activate', (evt) => {
  console.log('[ServiceWorker] Ativando');
  evt.waitUntil(
    caches.keys().then((keyList) => {
      return Promise.all(keyList.map((key) => {
        if (key !== CACHE_NAME && key !== DATA_CACHE_NAME) {
          console.log('[ServiceWorker] Removendo cache antigo', key);
          return caches.delete(key);
        }
      }));
    })
  );
  self.clients.claim();
});

// 3. Interceptar requisições (Fetch)
self.addEventListener('fetch', (evt) => {
  const url = new URL(evt.request.url);

  // ESTRATÉGIA PARA API (SUPABASE): Network First, depois Cache
  // Se tiver internet, pega o dado novo e atualiza o cache.
  // Se não tiver, pega do cache.
  if (url.hostname.includes('supabase.co')) {
    evt.respondWith(
      caches.open(DATA_CACHE_NAME).then((cache) => {
        return fetch(evt.request)
          .then((response) => {
            // Se a resposta for válida, clona e guarda no cache
            if (response.status === 200) {
              cache.put(evt.request.url, response.clone());
            }
            return response;
          })
          .catch((err) => {
            // Se falhar (offline), tenta pegar do cache
            return cache.match(evt.request.url);
          });
      })
    );
    return;
  }

  // ESTRATÉGIA PARA ARQUIVOS ESTÁTICOS: Stale-While-Revalidate
  // Tenta servir do cache rápido, mas busca atualização em background
  evt.respondWith(
    caches.match(evt.request).then((cachedResponse) => {
      const fetchPromise = fetch(evt.request).then((networkResponse) => {
        caches.open(CACHE_NAME).then((cache) => {
          cache.put(evt.request, networkResponse.clone());
        });
        return networkResponse;
      });
      return cachedResponse || fetchPromise;
    })
  );
});