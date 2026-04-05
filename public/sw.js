const CACHE_NAME = 'daily-focus-v1';
const BASE_PATH = new URL(self.registration.scope).pathname;
const INDEX_PATH = new URL('index.html', self.registration.scope).pathname;
const OFFLINE_PATH = new URL('offline.html', self.registration.scope).pathname;

const toScopedPath = (asset) => new URL(asset, self.registration.scope).pathname;

const APP_SHELL = [
  BASE_PATH,
  INDEX_PATH,
  toScopedPath('manifest.json'),
  OFFLINE_PATH,
  toScopedPath('icons/icon-192.png'),
  toScopedPath('icons/icon-512.png'),
  toScopedPath('icons/icon-maskable-512.png')
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;

  if (request.method !== 'GET') {
    return;
  }

  const url = new URL(request.url);

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) {
            const copy = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(INDEX_PATH, copy));
          }
          return response;
        })
        .catch(async () => (await caches.match(INDEX_PATH)) || (await caches.match(OFFLINE_PATH)))
    );
    return;
  }

  if (url.origin !== self.location.origin) {
    return;
  }

  event.respondWith(
    caches.match(request).then((cachedResponse) => {
      if (cachedResponse) {
        return cachedResponse;
      }

      return fetch(request).then((response) => {
        if (response.ok) {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
        }

        return response;
      });
    })
  );
});
