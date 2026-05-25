/**
 * EyeWall Analytics — Service Worker
 * Receives Web Push notifications and displays them.
 * Lives at /sw.js (served from public/ folder).
 */

const CACHE_NAME = 'eyewall-v1';

// ── Install + activate ────────────────────────────────────────
self.addEventListener('install',  () => self.skipWaiting());
self.addEventListener('activate', e  => e.waitUntil(self.clients.claim()));

// ── Push event — show notification ───────────────────────────
self.addEventListener('push', e => {
  let data = {};
  try { data = e.data?.json() || {}; } catch { data = { title: 'EyeWall Analytics', body: e.data?.text() || '' }; }

  const { title = 'EyeWall Analytics', body = '', icon, badge, tag, url = '/', data: extraData } = data;

  e.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon:  icon  || '/favicon-192.png',
      badge: badge || '/favicon-32.png',
      tag,                          // same tag = replace previous (e.g. live score updates)
      renotify: !!tag,              // buzz again even if replacing same-tag notification
      data: { url, ...extraData },
      vibrate: [200, 100, 200],     // short buzz pattern
    })
  );
});

// ── Notification click — open/focus the app ───────────────────
self.addEventListener('notificationclick', e => {
  e.notification.close();
  const targetUrl = e.notification.data?.url || '/';

  e.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clients => {
      // Focus existing tab if already open
      const existing = clients.find(c => c.url.includes(self.location.origin));
      if (existing) return existing.focus().then(c => c.navigate(targetUrl));
      // Otherwise open a new tab
      return self.clients.openWindow(targetUrl);
    })
  );
});
