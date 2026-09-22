/**
 * useWakeLock — Prevents the screen from sleeping while active.
 *
 * Native iOS app: the KeepAwake plugin (ios/App/App/SceneDelegate.swift),
 * which switches off the idle timer. The web Screen Wake Lock API alone
 * wasn't reliably honored inside the app's WKWebView -- "keep screen on
 * during live games doesn't work" (2026-09 preseason). iOS restores the
 * idle timer by itself when the app leaves the foreground.
 *
 * Web: the Screen Wake Lock API (Chrome/Android + Safari iOS 16.4+). Fails
 * silently on unsupported browsers. The browser releases the lock when the
 * tab goes to the background; it's re-acquired on return.
 *
 * Usage:
 *   useWakeLock(isLive); // hold lock only during live games
 */
import { useEffect } from 'react';
import { Capacitor, registerPlugin } from '@capacitor/core';

const KeepAwake = registerPlugin('KeepAwake');

export function useWakeLock(active) {
  // Native
  useEffect(() => {
    if (!active || !Capacitor.isNativePlatform()) return;
    KeepAwake.keepAwake().catch(() => {}); // older build without the plugin
    return () => { KeepAwake.allowSleep().catch(() => {}); };
  }, [active]);

  // Web
  useEffect(() => {
    if (!active || Capacitor.isNativePlatform() || !('wakeLock' in navigator)) return;

    let lock = null;
    let cancelled = false;
    const acquire = () => {
      if (lock && !lock.released) return;
      navigator.wakeLock.request('screen')
        .then(l => {
          // A request that resolves after cleanup would otherwise hold the
          // screen on with nothing left to release it.
          if (cancelled) l.release();
          else lock = l;
        })
        .catch(() => {}); // permission denied or not available
    };
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') acquire();
    };

    acquire();
    document.addEventListener('visibilitychange', handleVisibility);
    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', handleVisibility);
      lock?.release();
    };
  }, [active]);
}
