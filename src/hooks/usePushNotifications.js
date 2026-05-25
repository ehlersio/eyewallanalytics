/**
 * usePushNotifications — handles service worker registration,
 * permission request, and subscription management.
 *
 * Returns:
 *   { supported, permission, subscribed, subscribe, unsubscribe, loading, error }
 */

import { useState, useEffect, useCallback } from 'react';

// Replace with your actual VAPID public key
const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY || '';
const WORKER_URL       = import.meta.env.VITE_WORKER_URL       || '';

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64  = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  return Uint8Array.from([...rawData].map(c => c.charCodeAt(0)));
}

export function usePushNotifications() {
  const [supported,   setSupported]   = useState(false);
  const [permission,  setPermission]  = useState('default');
  const [subscribed,  setSubscribed]  = useState(false);
  const [loading,     setLoading]     = useState(false);
  const [error,       setError]       = useState(null);
  const [swReg,       setSwReg]       = useState(null);

  // Register service worker + check existing subscription on mount
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
        return reg.pushManager.getSubscription();
      })
      .then(existing => {
        setSubscribed(!!existing);
      })
      .catch(err => {
        console.warn('SW registration failed:', err);
        setError('Service worker registration failed');
      });
  }, []);

  // Subscribe to push notifications
  const subscribe = useCallback(async () => {
    if (!swReg || !VAPID_PUBLIC_KEY || !WORKER_URL) {
      setError('Push notifications not configured');
      return false;
    }
    setLoading(true);
    setError(null);
    try {
      // Request permission
      const perm = await Notification.requestPermission();
      setPermission(perm);
      if (perm !== 'granted') {
        setError('Notification permission denied');
        return false;
      }

      // Subscribe with VAPID
      const sub = await swReg.pushManager.subscribe({
        userVisibleOnly:      true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
      });

      // Send subscription to Worker for storage
      const res = await fetch(`${WORKER_URL}/push/subscribe`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(sub.toJSON()),
      });

      if (!res.ok) throw new Error('Failed to save subscription');

      setSubscribed(true);
      return true;
    } catch (err) {
      setError(err.message);
      return false;
    } finally {
      setLoading(false);
    }
  }, [swReg]);

  // Unsubscribe
  const unsubscribe = useCallback(async () => {
    if (!swReg) return;
    setLoading(true);
    try {
      const sub = await swReg.pushManager.getSubscription();
      if (sub) {
        // Tell Worker to remove this subscription
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
