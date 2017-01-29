'use strict';

const CACHE_VERSION = 0.1;
const OFFLINE_CACHE = `meteo.fvg-v${ CACHE_VERSION }`;

self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(OFFLINE_CACHE).then(cache => {
            return cache.addAll([
                'img/symbols-sprite.png',
                'img/ui-sprite.svg',
                'css/fonts/roboto-regular.ttf',
                'css/fonts/roboto-light.ttf',
                'css/fonts/roboto-medium.ttf',
                'css/fonts/roboto-bold.ttf',
            ]);
        })
    );
});

self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys().then(keys => {
            return Promise.all(
                keys.map(key => {
                    if (key != OFFLINE_CACHE) {
                        return caches.delete(key);
                    }
                })
            );
        })
    );
});

self.addEventListener('fetch', event => {
    if (event.request.mode == 'navigate') {
        console.log(`Handling fetch event for ${ event.request.url }`);

        event.respondWith(
            fetch(event.request).catch(exception => {
                // The `catch` is only triggered if `fetch()` throws an exception,
                // which most likely happens due to the server being unreachable.
                console.error( 'Fetch failed; returning offline page instead.', exception);

//                return caches.open(OFFLINE_CACHE).then(cache => {
//                    return cache.match(OFFLINE_URL);
//                });
            })
        );
    } else {
        // It’s not a request for an HTML document, but rather for a CSS or SVG
        // file or whatever…
        event.respondWith(
            caches.match(event.request).then(response => {
                return response || fetch(event.request);
            })
        );
    }
});
