'use strict';
var CACHE = 'sport-plan-v6';
/* 入口页候选：部署时按指南改名为 index.html（首选）；未改名时自动退回中文原名 */
var PAGES = ['./index.html', './健身与AI学习打卡系统.html'];
var ASSETS = PAGES.concat([
  './manifest.json',
  './icon-180.png',
  './icon-192.png',
  './icon-512.png',
  './icon-512-maskable.png'
]);

/* 依次尝试候选入口页，返回第一个命中的缓存 */
function cachedPage() {
  var i = 0;
  function step() {
    if (i >= PAGES.length) return Promise.resolve(null);
    return caches.match(PAGES[i++]).then(function (r) { return r || step(); });
  }
  return step();
}

self.addEventListener('install', function (e) {
  e.waitUntil(
    caches.open(CACHE).then(function (cache) {
      /* 逐个缓存：不存在的候选名（如尚未改名的 index.html）失败也不拖垮安装 */
      return Promise.all(ASSETS.map(function (url) {
        return cache.add(url).catch(function () { return null; });
      }));
    }).then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener('activate', function (e) {
  e.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.filter(function (k) { return k !== CACHE; }).map(function (k) { return caches.delete(k); }));
    }).then(function () { return self.clients.claim(); })
  );
});

self.addEventListener('fetch', function (e) {
  if (e.request.method !== 'GET') return;
  var url = new URL(e.request.url);
  if (url.origin !== location.origin) return;

  /* 页面：stale-while-revalidate —— 先给缓存，后台拉新版，下次打开即最新 */
  if (e.request.mode === 'navigate') {
    e.respondWith(
      caches.match(e.request, { ignoreSearch: true }).then(function (cached) {
        var fresh = fetch(e.request).then(function (res) {
          var copy = res.clone();
          caches.open(CACHE).then(function (c) { c.put(e.request, copy); });
          return res;
        }).catch(function () { return cached || cachedPage(); });
        return cached || fresh;
      })
    );
    return;
  }

  /* 静态资源：cache-first，未命中再网络并回填 */
  e.respondWith(
    caches.match(e.request).then(function (hit) {
      if (hit) return hit;
      return fetch(e.request).then(function (res) {
        if (res.ok) {
          var copy = res.clone();
          caches.open(CACHE).then(function (c) { c.put(e.request, copy); });
        }
        return res;
      }).catch(function () { return cachedPage(); });
    })
  );
});
