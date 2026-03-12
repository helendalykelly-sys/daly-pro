const CACHE_NAME = 'daly-pro-v3';
const OFFLINE_URL = 'daly-pro.html';

const PRECACHE_URLS = [
    OFFLINE_URL,
    'https://cdn.tailwindcss.com',
    'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css',
    'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js'
];

// Install — cache app shell
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            return cache.addAll(PRECACHE_URLS);
        }).then(() => self.skipWaiting())
    );
});

// Activate — clear old caches
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((names) => {
            return Promise.all(
                names.filter(n => n !== CACHE_NAME).map(n => caches.delete(n))
            );
        }).then(() => self.clients.claim())
    );
});

// Fetch — network first, cache fallback
self.addEventListener('fetch', (event) => {
    const { request } = event;

    // Skip non-GET and chrome-extension requests
    if (request.method !== 'GET' || request.url.startsWith('chrome-extension')) return;

    // API calls — network only (Gemini, Nominatim, Firebase)
    if (request.url.includes('generativelanguage.googleapis.com') ||
        request.url.includes('nominatim.openstreetmap.org') ||
        request.url.includes('firestore.googleapis.com') ||
        request.url.includes('identitytoolkit.googleapis.com')) {
        return;
    }

    // Map tiles — cache first, then network
    if (request.url.includes('basemaps.cartocdn.com')) {
        event.respondWith(
            caches.match(request).then((cached) => {
                const fetched = fetch(request).then((response) => {
                    if (response.ok) {
                        const clone = response.clone();
                        caches.open(CACHE_NAME).then(c => c.put(request, clone));
                    }
                    return response;
                }).catch(() => cached);
                return cached || fetched;
            })
        );
        return;
    }

    // Everything else — network first, cache fallback
    event.respondWith(
        fetch(request).then((response) => {
            if (response.ok) {
                const clone = response.clone();
                caches.open(CACHE_NAME).then(c => c.put(request, clone));
            }
            return response;
        }).catch(() => {
            return caches.match(request).then((cached) => {
                return cached || caches.match(OFFLINE_URL);
            });
        })
    );
});
