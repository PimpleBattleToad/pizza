/* Офлайн-кэш калькулятора неаполитанской пиццы.
   Меняйте номер версии при правках — иначе телефон останется на старых файлах. */
var CACHE = 'pizza-v4';

var ASSETS = [
  './',
  './index.html',
  './pizza.html',
  './manifest.json',
  './icons/icon-180.png',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/maskable-512.png'
];

self.addEventListener('install', function(event){
  event.waitUntil(
    caches.open(CACHE).then(function(cache){
      /* каждый файл кладём отдельно: один недоступный не отменяет установку */
      return Promise.all(ASSETS.map(function(url){
        return cache.add(url).catch(function(){ /* пропускаем */ });
      }));
    }).then(function(){ return self.skipWaiting(); })
  );
});

self.addEventListener('activate', function(event){
  event.waitUntil(
    caches.keys().then(function(keys){
      return Promise.all(keys.filter(function(k){ return k !== CACHE; }).map(function(k){
        return caches.delete(k);
      }));
    }).then(function(){ return self.clients.claim(); })
  );
});

self.addEventListener('fetch', function(event){
  var req = event.request;
  if (req.method !== 'GET') return;

  /* страница: сначала сеть (правки видны сразу), офлайн — из кэша */
  if (req.mode === 'navigate'){
    event.respondWith(
      fetch(req).catch(function(){
        return caches.match(req).then(function(hit){
          return hit || caches.match('./pizza.html');
        });
      })
    );
    return;
  }

  /* остальное: сначала кэш, потом сеть */
  event.respondWith(
    caches.match(req).then(function(hit){
      return hit || fetch(req).then(function(res){
        var copy = res.clone();
        caches.open(CACHE).then(function(c){ c.put(req, copy); });
        return res;
      }).catch(function(){ return hit; });
    })
  );
});
