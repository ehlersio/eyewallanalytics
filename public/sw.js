/**
 * EyeWall Analytics — Service Worker v2.0
 *
 * Reads notification content directly from the encrypted push payload
 * (RFC 8291 / aes128gcm). No KV fetch needed — payload carries
 * { title, body, tag, url } from the Worker.
 */

self.addEventListener('install',  () => self.skipWaiting());
self.addEventListener('activate', e  => e.waitUntil(self.clients.claim()));

self.addEventListener('push', e => {
  e.waitUntil(handlePush(e));
});

async function handlePush(e) {
  let title = 'EyeWall Analytics';
  let body  = 'New update!';
  let tag   = 'eyewall';
  let url   = '/';

  // Read payload directly — Worker sends encrypted { title, body, tag, url }
  if (e.data) {
    try {
      const data = e.data.json();
      title = data.title || title;
      body  = data.body  || body;
      tag   = data.tag   || tag;
      url   = data.url   || url;
    } catch {
      // Payload not JSON — use text as body
      body = e.data.text() || body;
    }
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
