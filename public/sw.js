const CACHE_NAME = 'svelta-shell-v1';
const STATIC_ASSETS = [
    '/',
    '/favicon/apple-touch-icon.png',
    '/favicon/web-app-manifest-192x192.png',
    '/favicon/web-app-manifest-512x512.png',
    '/favicon/favicon-96x96.png',
];

self.addEventListener('install', (event) => {
    self.skipWaiting();
    event.waitUntil(
        caches
            .open(CACHE_NAME)
            .then((cache) => cache.addAll(STATIC_ASSETS))
            .catch(() => undefined)
    );
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((keys) =>
            Promise.all(
                keys
                    .filter((key) => key !== CACHE_NAME)
                    .map((key) => caches.delete(key))
            )
        )
    );

    self.clients.claim();
});

self.addEventListener('fetch', (event) => {
    if (event.request.method !== 'GET') return;

    const requestUrl = new URL(event.request.url);
    if (requestUrl.origin !== self.location.origin) return;

    if (event.request.mode === 'navigate') {
        event.respondWith(
            fetch(event.request).catch(async () => {
                const cache = await caches.open(CACHE_NAME);
                return cache.match('/') || Response.error();
            })
        );
        return;
    }

    const isStaticAsset =
        requestUrl.pathname.startsWith('/favicon/') ||
        requestUrl.pathname.startsWith('/icons/') ||
        requestUrl.pathname.match(/\.(?:png|svg|jpg|jpeg|gif|webp|ico)$/i);

    if (!isStaticAsset) return;

    event.respondWith(
        caches.match(event.request).then((cached) => {
            if (cached) return cached;

            return fetch(event.request).then((response) => {
                const copy = response.clone();
                void caches
                    .open(CACHE_NAME)
                    .then((cache) => cache.put(event.request, copy));
                return response;
            });
        })
    );
});
