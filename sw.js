/* Claude Finance mirror: lets the Home Screen app open without a connection.
   Every request goes to the network first, so a new version always wins when there is signal; the last good copy
   of each file is kept here for when there isn't. data.json is the locked copy, so keeping it reveals nothing. */
const CACHE = 'ctm-1';

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil(self.clients.claim()));

self.addEventListener('fetch', e => {
  const req = e.request, url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== self.location.origin) return;
  const key = url.origin + url.pathname;  // one copy per file: ?t= and ?v= are only there to get past caches
  e.respondWith((async () => {
    const cache = await caches.open(CACHE);
    try {
      // the page itself is always re-checked, so an update shows the next time the app opens
      const res = await (req.mode === 'navigate' ? fetch(req.url, { cache: 'no-cache', credentials: 'same-origin' }) : fetch(req));
      if (res.ok && res.type === 'basic') cache.put(key, res.clone());
      return res;
    } catch (err) {
      const hit = (await cache.match(key)) || (req.mode === 'navigate' ? await cache.match(new URL('./', self.registration.scope).href) : null);
      if (hit) return hit;
      throw err;
    }
  })());
});

/* Notifications from Sam's Mac (signal_lab/push.py): show each one, and open the right page when it's tapped. */
self.addEventListener('push', e => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch (err) { d = { body: e.data ? e.data.text() : '' }; }
  e.waitUntil(self.registration.showNotification(d.title || 'Claude Finance', {
    body: d.body || '', tag: d.tag || undefined, data: { url: d.url || './' }, icon: 'icon-180.png', badge: 'icon-180.png' }));
});
self.addEventListener('notificationclick', e => {
  e.notification.close();
  const url = new URL((e.notification.data || {}).url || './', self.registration.scope).href;
  e.waitUntil((async () => {
    for (const w of await clients.matchAll({ type: 'window', includeUncontrolled: true })) {
      if ('focus' in w) {
        await w.focus();
        return 'navigate' in w ? w.navigate(url) : undefined;
      }
    }
    return clients.openWindow(url);
  })());
});
