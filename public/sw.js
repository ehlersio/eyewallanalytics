/**
 * EyeWall Analytics — Service Worker v1.2
 */

const WORKER_URL = 'https://eyewall-poller.billowing-queen-bf23.workers.dev';

self.addEventListener('install',  () => {
  console.log('[SW] Installing v1.2');
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  console.log('[SW] Activated');
  e.waitUntil(self.clients.claim());
});

self.addEventListener('push', e => {
  console.log('[SW] Push event received');
  e.waitUntil(showNotification());
});

async function showNotification() {
  console.log('[SW] showNotification called');

  let title = 'EyeWall Analytics';
  let body  = 'New update from the Canes!';
  let tag   = 'eyewall';
  let url   = '/';

  try {
    console.log('[SW] Fetching notification details from Worker...');
    const res = await fetch(`${WORKER_URL}/cache/latest-notification`, {
      cache: 'no-store',
    });
    console.log('[SW] Fetch status:', res.status);
    if (res.ok) {
      const data = await res.json();
      console.log('[SW] Notification data:', JSON.stringify(data));
      title = data.title || title;
      body  = data.body  || body;
      tag   = data.tag   || tag;
      url   = data.url   || url;
    }
  } catch (err) {
    console.error('[SW] Fetch error:', err.message);
  }

  console.log('[SW] Showing notification:', title, body);

  try {
    await self.registration.showNotification(title, {
      body,
      icon:     '/favicon-192.png',
      badge:    '/favicon-32.png',
      tag,
      renotify: true,
      data:     { url },
      vibrate:  [200, 100, 200],
    });
    console.log('[SW] showNotification succeeded');
  } catch (err) {
    console.error('[SW] showNotification failed:', err.message);
  }
}

self.addEventListener('notificationclick', e => {
  console.log('[SW] Notification clicked');
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
