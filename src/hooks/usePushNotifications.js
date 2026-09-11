/**
 * usePushNotifications
 *
 * Two independent mechanisms behind one shared API (supported/permission/
 * subscribed/subscribe/unsubscribe/updatePrefs), picked by platform:
 * - Browser/installed-PWA: Web Push (VAPID + this app's own sw.js).
 *   Safari/iOS requirements: requestPermission()+subscribe() must be
 *   called directly in a user gesture; iOS requires the site added to
 *   Home Screen; same Web Push standard as Chrome/Firefox on iOS 16.4+.
 * - Native iOS (Capacitor): real APNs push via @capacitor/push-notifications
 *   (added 2026-09) — Web Push doesn't reach a native shell at all.
 */

import { useState, useEffect, useCallback } from 'react';
import { Capacitor } from '@capacitor/core';
import { PushNotifications } from '@capacitor/push-notifications';

const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY || '';
const WORKER_URL       = import.meta.env.VITE_WORKER_URL       || '';
// APNs has no "getSubscription()" query the way Web Push does -- there's no
// way to ask iOS "what's my current token" without calling register() again
// (harmless/idempotent once permission is granted, but still an extra
// native round-trip). Persist the last known-good token locally so mount
// can restore `subscribed` state across app relaunches without that.
const NATIVE_TOKEN_KEY = 'eyewall:notif:ios-token';

// Default preferences — all on
export const DEFAULT_PREFS = {
  goal:         true,
  oppGoal:      true,
  gameStart:    true,
  periodStart:  true,
  periodEnd:    false, // off by default — noisy
  penalty:      true,
  win:          true,
  loss:         true,
  goaliePulled: true,
  hatTrick:     true,
};

const PREFS_KEY = 'eyewall:notif:prefs';

export function loadPrefs() {
  try {
    const raw = localStorage.getItem(PREFS_KEY);
    return raw ? { ...DEFAULT_PREFS, ...JSON.parse(raw) } : { ...DEFAULT_PREFS };
  } catch {
    return { ...DEFAULT_PREFS };
  }
}

export function savePrefs(prefs) {
  try {
    localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
  } catch {}
}

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64  = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  return Uint8Array.from([...rawData].map(c => c.charCodeAt(0)));
}

// Resolves the APNs device token from a fresh PushNotifications.register()
// call -- wires up one-shot 'registration'/'registrationError' listeners,
// fires register(), and cleans its own listeners up either way so repeat
// calls (e.g. re-subscribing after a permission change) don't accumulate.
// Module-level, not a hook closure -- touches only the PushNotifications
// singleton, no component state.
function registerNativeDevice() {
  return new Promise((resolve, reject) => {
    (async () => {
      const regHandle = await PushNotifications.addListener('registration', token => {
        regHandle.remove();
        errHandle.remove();
        resolve(token.value);
      });
      const errHandle = await PushNotifications.addListener('registrationError', err => {
        regHandle.remove();
        errHandle.remove();
        reject(new Error(err.error || 'APNs registration failed'));
      });
      await PushNotifications.register();
    })();
  });
}

export function usePushNotifications() {
  const [supported,  setSupported]  = useState(false);
  const [permission, setPermission] = useState('default');
  const [subscribed, setSubscribed] = useState(false);
  const [loading,    setLoading]    = useState(false);
  const [error,      setError]      = useState(null);
  const [swReg,       setSwReg]       = useState(null);
  const [deviceToken, setDeviceToken] = useState(null);

  useEffect(() => {
    if (Capacitor.isNativePlatform()) {
      let cancelled = false;
      (async () => {
        setSupported(true);
        const status = await PushNotifications.checkPermissions();
        const perm = status.receive === 'granted' ? 'granted' : status.receive === 'denied' ? 'denied' : 'default';
        if (cancelled) return;
        setPermission(perm);
        if (perm === 'granted') {
          const storedToken = localStorage.getItem(NATIVE_TOKEN_KEY);
          if (storedToken) {
            setDeviceToken(storedToken);
            setSubscribed(true);
          }
        }
      })();
      return () => { cancelled = true; };
    }

    // Web Push (VAPID + this app's own sw.js) is a browser-PWA mechanism --
    // it doesn't apply inside the native iOS shell, handled above instead.
    // Registering sw.js under Capacitor's WKWebView would just add an
    // unused caching layer with no functional benefit -- skip it entirely
    // rather than register-then-never-use.
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      setSupported(false);
      return;
    }
    setSupported(true);
    setPermission(Notification.permission);

    navigator.serviceWorker.register('/sw.js', { scope: '/' })
      .then(reg => {
        setSwReg(reg);
        const sw = reg.active || reg.waiting || reg.installing;
        if (sw && sw.state !== 'activated') {
          sw.addEventListener('statechange', () => {
            if (sw.state === 'activated') reg.pushManager.getSubscription().then(s => setSubscribed(!!s));
          });
        }
        return reg.pushManager.getSubscription();
      })
      .then(existing => { if (existing) setSubscribed(true); })
      .catch(err => {
        console.warn('[Push] SW registration failed:', err);
        setSupported(false);
      });
  }, []);

  // Must be called directly from a user gesture (button click)
  // teamAbbr: league-prefixed team key, e.g. 'NHL:CAR' or 'PWHL:MTL'
  // prefs: notification preference object
  const subscribe = useCallback(async (teamAbbr = 'CAR', prefs = null) => {
    if (Capacitor.isNativePlatform()) {
      if (!WORKER_URL) {
        setError('Push notifications not configured');
        return false;
      }
      setLoading(true);
      setError(null);
      try {
        const status = await PushNotifications.requestPermissions();
        const perm = status.receive === 'granted' ? 'granted' : 'denied';
        setPermission(perm);
        if (perm !== 'granted') {
          setError('Permission not granted');
          return false;
        }

        const token = await registerNativeDevice();
        setDeviceToken(token);
        localStorage.setItem(NATIVE_TOKEN_KEY, token);

        const res = await fetch(`${WORKER_URL}/push/subscribe`, {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify({ platform: 'ios', token, teamAbbr, prefs: prefs || loadPrefs() }),
        });
        if (!res.ok) throw new Error('Failed to save subscription to server');

        setSubscribed(true);
        return true;
      } catch (err) {
        setError(err.message);
        return false;
      } finally {
        setLoading(false);
      }
    }

    if (!swReg || !VAPID_PUBLIC_KEY || !WORKER_URL) {
      setError('Push notifications not configured');
      return false;
    }
    setLoading(true);
    setError(null);
    try {
      const perm = await Notification.requestPermission();
      setPermission(perm);
      if (perm !== 'granted') {
        setError(perm === 'denied' ? 'Permission denied — enable in browser settings' : 'Permission not granted');
        return false;
      }

      const reg = await navigator.serviceWorker.ready;

      const sub = await reg.pushManager.subscribe({
        userVisibleOnly:      true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
      });

      const subJson = sub.toJSON();

      const res = await fetch(`${WORKER_URL}/push/subscribe`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          ...subJson,
          teamAbbr: teamAbbr,
          prefs:    prefs || loadPrefs(),
        }),
      });

      if (!res.ok) throw new Error('Failed to save subscription to server');

      setSubscribed(true);
      return true;
    } catch (err) {
      setError(err.message);
      return false;
    } finally {
      setLoading(false);
    }
  }, [swReg]);

  // Update prefs on server without re-subscribing
  const updatePrefs = useCallback(async (teamAbbr, prefs) => {
    if (Capacitor.isNativePlatform()) {
      if (!deviceToken || !WORKER_URL) return false;
      try {
        const res = await fetch(`${WORKER_URL}/push/subscribe`, {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify({ platform: 'ios', token: deviceToken, teamAbbr, prefs }),
        });
        return res.ok;
      } catch {
        return false;
      }
    }

    if (!swReg || !WORKER_URL) return false;
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (!sub) return false;

      const res = await fetch(`${WORKER_URL}/push/subscribe`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          ...sub.toJSON(),
          teamAbbr,
          prefs,
        }),
      });
      return res.ok;
    } catch {
      return false;
    }
  }, [swReg, deviceToken]);

  const unsubscribe = useCallback(async () => {
    if (Capacitor.isNativePlatform()) {
      if (!deviceToken) return;
      setLoading(true);
      try {
        await fetch(`${WORKER_URL}/push/unsubscribe`, {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify({ token: deviceToken }),
        }).catch(() => {});
        // APNs has no per-device "unsubscribe" the way Web Push does --
        // telling our own backend to stop sending is what actually matters;
        // unregister() just drops iOS's local registration state on top.
        await PushNotifications.unregister().catch(() => {});
        localStorage.removeItem(NATIVE_TOKEN_KEY);
        setDeviceToken(null);
        setSubscribed(false);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
      return;
    }

    if (!swReg) return;
    setLoading(true);
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        await fetch(`${WORKER_URL}/push/unsubscribe`, {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify({ endpoint: sub.endpoint }),
        }).catch(() => {});
        await sub.unsubscribe();
      }
      setSubscribed(false);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [swReg, deviceToken]);

  return { supported, permission, subscribed, subscribe, unsubscribe, updatePrefs, loading, error };
}
