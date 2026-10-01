// hooks/useNotificationTaps.js
// iOS app: a tapped notification goes where its `url` says (eyewall-poller
// puts it in the APNs payload next to `aps`) -- e.g. an End of P1 push to
// /?summary=1&game=..., which opens that summary. The web's equivalent is
// sw.js's notificationclick. Pushes without a url just open the app.
//
// Mounted once inside the router (App.jsx). Capacitor holds a tap that
// launched the app until a listener is added, so a cold start from a
// notification is covered too.
//
// It also passes on a push that arrives while the app is open (iOS
// foreground, or sw.js on the web) as signalPushReceived(), so the shot
// map re-checks for a live game right away.
import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Capacitor } from '@capacitor/core';
import { PushNotifications } from '@capacitor/push-notifications';
import { signalPushReceived } from '../utils/livePolling';

// Only this app's own paths: "/x", never "//host" or a full URL.
export const isInAppPath = url => typeof url === 'string' && url.startsWith('/') && !url.startsWith('//');

export function useNotificationTaps() {
  const navigate = useNavigate();
  useEffect(() => {
    if (Capacitor.isNativePlatform()) {
      const handle = PushNotifications.addListener('pushNotificationReceived', signalPushReceived);
      return () => { handle.then(h => h.remove()).catch(() => {}); };
    }
    const sw = navigator.serviceWorker;
    if (!sw) return;
    const onMessage = e => { if (e.data?.type === 'push-received') signalPushReceived(); };
    sw.addEventListener('message', onMessage);
    return () => sw.removeEventListener('message', onMessage);
  }, []);
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    const handle = PushNotifications.addListener('pushNotificationActionPerformed', ({ notification }) => {
      const url = notification?.data?.url;
      if (isInAppPath(url)) navigate(url);
    });
    return () => { handle.then(h => h.remove()).catch(() => {}); };
  }, [navigate]);
}
