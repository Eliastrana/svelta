const CACHE_NAME = 'svelta-shell-v1';
const STATIC_ASSETS = [
    '/',
    '/favicon/apple-touch-icon.png',
    '/favicon/web-app-manifest-192x192.png',
    '/favicon/web-app-manifest-512x512.png',
    '/favicon/favicon-96x96.png',
];

function buildNotificationFromPayload(payload) {
    const data = payload?.data ?? {};
    const notification = payload?.notification ?? {};

    const title =
        data.title ||
        notification.title ||
        'Svelta';

    const body =
        data.body ||
        notification.body ||
        '';

    const link = data.link || '/';
    const icon =
        data.icon ||
        notification.icon ||
        '/favicon/web-app-manifest-192x192.png';
    const badge =
        data.badge ||
        notification.badge ||
        '/favicon/favicon-96x96.png';
    const tag = data.tag || notification.tag || 'svelta-notification';

    return {
        title,
        options: {
            body,
            icon,
            badge,
            tag,
            data: {
                link,
            },
        },
    };
}

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

self.addEventListener('push', (event) => {
    if (!event.data) return;

    let payload = null;

    try {
        payload = event.data.json();
    } catch {
        payload = { notification: { title: 'Svelta', body: event.data.text() } };
    }

    const { title, options } = buildNotificationFromPayload(payload);

    event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
    event.notification.close();

    const targetPath = event.notification.data?.link || '/';
    const targetUrl = new URL(targetPath, self.location.origin).toString();

    event.waitUntil(
        self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
            for (const client of clients) {
                if ('focus' in client && client.url === targetUrl) {
                    return client.focus();
                }
            }

            if (self.clients.openWindow) {
                return self.clients.openWindow(targetUrl);
            }

            return undefined;
        })
    );
});
