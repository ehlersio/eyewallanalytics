/**
 * usePushNotifications
 *
 * Safari/iOS requirements:
 * 1. requestPermission() + subscribe() must be called directly in a user gesture
 * 2. iOS requires site added to Home Screen (PWA) for push to work
 * 3. Same Web Push standard as Chrome/Firefox on iOS 16.4+
 */

import { useState, useEffect, useCallback } from 'react';

const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY || '';
const WORKER_URL       = import.meta.env.VITE_WORKER_URL       || '';

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64  = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  return Uint8Array.from([...rawData].map(c => c.charCodeAt(0)));
}

export function usePushNotifications() {
  const [supported,  setSupported]  = useState(false);
  const [permission, setPermission] = useState('default');
  const [subscribed, setSubscribed] = useState(false);
  const [loading,    setLoading]    = useState(false);
  const [error,      setError]      = useState(null);
  const [swReg,      setSwReg]      = useState(null);

  useEffect(() => {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      setSupported(false);
      return;
    }
    setSupported(true);
    setPermission(Notification.permission);

    navigator.serviceWorker.register('/sw.js', { scope: '/' })
      .then(reg => {
        setSwReg(reg);
        // Wait for active SW
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
  const subscribe = useCallback(async () => {
    if (!swReg || !VAPID_PUBLIC_KEY || !WORKER_URL) {
      setError('Push notifications not configured');
      return false;
    }
    setLoading(true);
    setError(null);
    try {
      // requestPermission MUST be called synchronously in user gesture on Safari
      const perm = await Notification.requestPermission();
      setPermission(perm);
      if (perm !== 'granted') {
        setError(perm === 'denied' ? 'Permission denied — enable in browser settings' : 'Permission not granted');
        return false;
      }

      // Wait for active service worker (Safari can be slow)
      const reg = await navigator.serviceWorker.ready;

      const sub = await reg.pushManager.subscribe({
        userVisibleOnly:      true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
      });

      const res = await fetch(`${WORKER_URL}/push/subscribe`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(sub.toJSON()),
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

  const unsubscribe = useCallback(async () => {
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
  }, [swReg]);

  return { supported, permission, subscribed, subscribe, unsubscribe, loading, error };
}
