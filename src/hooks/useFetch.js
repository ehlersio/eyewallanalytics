import { useState, useEffect, useRef, useCallback } from 'react';

// Generic fetch hook with stale-while-revalidate behaviour.
// If cached data exists (from nhlApi cache), it will appear instantly.
// The hook re-fetches if deps change.
export function useFetch(fetchFn, deps = []) {
  const [data,    setData]    = useState(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState(null);
  const mountedRef = useRef(true);
  const fetchRef   = useRef(fetchFn);
  // Bumped on every load() call, so a slower older call can recognize a
  // newer one has since started and discard its own result on arrival.
  // Without this, two fetches fired close together (e.g. a deps change
  // right after mount, before a user has interacted) can resolve out of
  // order -- the newer, correct response arrives first, then the older,
  // slower one arrives after and silently overwrites it with stale data,
  // even though nothing in the UI looks wrong until you compare the
  // rendered data against whatever deps are actually currently selected.
  const tokenRef = useRef(0);

  // Keep fetchRef current without triggering re-renders
  useEffect(() => { fetchRef.current = fetchFn; });

  const load = useCallback(async () => {
    const myToken = ++tokenRef.current;
    setLoading(true);
    setError(null);
    try {
      const result = await fetchRef.current();
      if (mountedRef.current && myToken === tokenRef.current) {
        setData(result);
        setLoading(false);
      }
    } catch (err) {
      if (mountedRef.current && myToken === tokenRef.current) {
        setError(err.message);
        setLoading(false);
      }
    }
  }, deps);

  useEffect(() => {
    mountedRef.current = true;
    load();
    return () => { mountedRef.current = false; };
  }, [load]);

  return { data, loading, error, refetch: load };
}

// Polls at `intervalMs`. Backs off to 5× the interval after 3 consecutive errors.
export function usePoll(fetchFn, intervalMs = 30000, deps = []) {
  const result      = useFetch(fetchFn, deps);
  const intervalRef = useRef(null);
  const errCount    = useRef(0);

  useEffect(() => {
    function tick() {
      result.refetch().then(() => {
        errCount.current = 0;
      }).catch(() => {
        errCount.current++;
      });
      // Reschedule with backoff if errors accumulating
      clearInterval(intervalRef.current);
      const ms = errCount.current >= 3 ? intervalMs * 5 : intervalMs;
      intervalRef.current = setInterval(tick, ms);
    }
    intervalRef.current = setInterval(tick, intervalMs);
    return () => clearInterval(intervalRef.current);
  }, [intervalMs, ...deps]);  

  return result;
}

// Tracks window width for responsive decisions
export function useWindowWidth() {
  const [width, setWidth] = useState(window.innerWidth);
  useEffect(() => {
    const handler = () => setWidth(window.innerWidth);
    window.addEventListener('resize', handler);
    return () => window.removeEventListener('resize', handler);
  }, []);
  return width;
}
