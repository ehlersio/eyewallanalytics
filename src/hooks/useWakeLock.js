/**
 * useWakeLock — Prevents the screen from sleeping while active.
 *
 * Uses the Screen Wake Lock API (Chrome/Android + Safari iOS 16.4+).
 * Fails silently on unsupported browsers.
 *
 * The lock is automatically released when the tab goes to the background
 * and re-acquired when the user returns — this is required browser behavior,
 * not a bug.
 *
 * Usage:
 *   useWakeLock(isLive); // hold lock only during live games
 */
import { useEffect, useRef } from 'react';

export function useWakeLock(active) {
  const lockRef = useRef(null);

  // Acquire or release based on active flag
  useEffect(() => {
    if (!('wakeLock' in navigator)) return;

    if (active) {
      navigator.wakeLock.request('screen')
        .then(lock => { lockRef.current = lock; })
        .catch(() => {}); // permission denied or not available — fail silently
    } else {
      lockRef.current?.release();
      lockRef.current = null;
    }

    return () => {
      lockRef.current?.release();
      lockRef.current = null;
    };
  }, [active]);

  // Re-acquire after returning from background — browsers release the lock
  // automatically when the page is hidden, so we need to re-request it.
  useEffect(() => {
    if (!active || !('wakeLock' in navigator)) return;

    const handleVisibility = () => {
      if (document.visibilityState === 'visible' && !lockRef.current) {
        navigator.wakeLock.request('screen')
          .then(lock => { lockRef.current = lock; })
          .catch(() => {});
      }
    };

    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, [active]);
}
