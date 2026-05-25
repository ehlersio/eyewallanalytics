/**
 * EyeWall Analytics — Service Worker
 * Receives Web Push notifications and displays them.
 *
 * Uses a payloadless push strategy:
 * 1. Worker sends a push with no body
 * 2. SW wakes up and fetches /api/notification to get the details
 * 3. SW displays the notification
 *
 * This avoids the complexity of RFC 8291 payload encryption.
 */

self.addEventListener('install',  () => self.skipWaiting());
self.addEventListener('activate', e  => e.waitUntil(self.clients.claim()));

// ── Push received ─────────────────────────────────────────────
self.addEventListener('push', e => {
  const showNotification = async () => {
    let data = { title: 'EyeWall Analytics', body: 'New update' };

    // Try to get notification details from our API
    try {
      const res = await fetch('/api/notification', { cache: 'no-store' });
      if (res.ok) data = await res.json();
    } catch { /* use defaults */ }

    const { title = 'EyeWall Analytics', body = '', tag, url = '/' } = data;

    await self.registration.showNotification(title, {
      body,
      icon:     '/favicon-192.png',
      badge:    '/favicon-32.png',
      tag:      tag || 'eyewall',
      renotify: true,
      data:     { url },
      vibrate:  [200, 100, 200],
    });
  };

  e.waitUntil(showNotification());
});

// ── Notification clicked ──────────────────────────────────────
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
