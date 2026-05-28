/**
 * EyeWall Analytics — Service Worker v1.2
 */

const WORKER_URL = 'https://eyewall-poller.billowing-queen-bf23.workers.dev';

self.addEventListener('install',  () => self.skipWaiting());
self.addEventListener('activate', e  => e.waitUntil(self.clients.claim()));

self.addEventListener('push', e => {
  e.waitUntil(showNotification());
});

async function showNotification() {
  let title = 'EyeWall Analytics';
  let body  = 'New update from the Canes!';
  let tag   = 'eyewall';
  let url   = '/';

  // Retry up to 3 times with 300ms delay — KV has eventual consistency lag
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      if (attempt > 0) await new Promise(r => setTimeout(r, 300));
      const res = await fetch(`${WORKER_URL}/cache/latest-notification`, {
        cache: 'no-store',
      });
      if (res.ok) {
        const data = await res.json();
        if (data.tag && data.tag !== 'eyewall') {
          // Got real data (not default)
          title = data.title || title;
          body  = data.body  || body;
          tag   = data.tag   || tag;
          url   = data.url   || url;
          break;
        }
      }
    } catch { /* continue */ }
  }

  return self.registration.showNotification(title, {
    body,
    icon:     '/favicon-192.png',
    badge:    '/favicon-32.png',
    tag,
    renotify: true,
    data:     { url },
    vibrate:  [200, 100, 200],
  });
}

self.addEventListener('notificationclick', e => {
  e.notification.close();
  const targetUrl = e.notification.data?.url || '/';

  e.waitUntil(
    self.clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then(clients => {
        const existing = clients.find(c => c.url.includes(self.location.origin));
        if (existing) return existing.focus().then(c => c.navigate(targetUrl));
        return self.clients.openWindow(targetUrl);
      })
  );
});
