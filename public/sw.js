const CACHE_NAME = 'frota-cache-v4';
const urlsToCache = [
  '/',
  '/index.html',
  '/manifest.json'
];

// Instalação do Service Worker
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('Cache aberto');
        return cache.addAll(urlsToCache);
      })
      .catch((error) => {
        console.error('Falha ao instalar cache inicial:', error);
      })
  );
  // Força o SW a ativar imediatamente, não esperando o antigo fechar
  self.skipWaiting();
});

// Ativação e limpeza de caches antigos
self.addEventListener('activate', (event) => {
  const cacheWhitelist = [CACHE_NAME];
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheWhitelist.indexOf(cacheName) === -1) {
            console.log('Deletando cache antigo:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  // Toma o controle das páginas imediatamente
  event.waitUntil(self.clients.claim());
});

// Interceptação de requisições
self.addEventListener('fetch', (event) => {
  // Ignora requisições que não são http/https (como chrome-extension://)
  if (!event.request.url.startsWith('http')) {
    return;
  }

  // ESTRATÉGIA NETWORK FIRST PARA HTML (NAVEGAÇÃO)
  // Isso garante que o usuário sempre receba a versão mais nova do app se estiver online.
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          // Atualiza o cache com a nova versão
          if (response && response.status === 200 && response.type === 'basic') {
            const responseToCache = response.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, responseToCache);
            });
          }
          return response;
        })
        .catch(() => {
          // Se offline, usa o cache
          return caches.match(event.request).then((response) => {
            return response || caches.match('/index.html');
          });
        })
    );
    return;
  }

  // ESTRATÉGIA CACHE FIRST PARA ASSETS ESTÁTICOS (JS, CSS, Imagens)
  // Melhora a performance carregando do cache primeiro
  event.respondWith(
    caches.match(event.request)
      .then((response) => {
        if (response) {
          return response;
        }
        return fetch(event.request).then(
          (response) => {
            if(!response || response.status !== 200 || response.type !== 'basic') {
              return response;
            }

            const responseToCache = response.clone();

            caches.open(CACHE_NAME)
              .then((cache) => {
                // Cacheia imagens, scripts e css
                if (event.request.url.match(/\.(js|css|png|jpg|jpeg|svg|ico|woff2)$/)) {
                  cache.put(event.request, responseToCache);
                }
              });

            return response;
          }
        );
      })
  );
});