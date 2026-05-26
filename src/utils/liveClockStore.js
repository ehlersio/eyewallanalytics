/**
 * liveClockStore — tiny pub/sub for sharing live clock state
 * between ShotMapView (which polls PBP) and Topbar.
 *
 * ShotMapView publishes timeRemaining + inIntermission whenever it gets fresh PBP.
 * Topbar subscribes and uses that data to drive its own countdown.
 * This eliminates the independent Topbar PBP fetch entirely.
 */

let _subscribers = [];
let _lastClock = null;

export function publishClock(timeRemaining, inIntermission) {
  _lastClock = { timeRemaining, inIntermission, ts: Date.now() };
  _subscribers.forEach(fn => fn(_lastClock));
}

export function subscribeClock(fn) {
  _subscribers.push(fn);
  // Immediately deliver last known value if available
  if (_lastClock) fn(_lastClock);
  return () => { _subscribers = _subscribers.filter(s => s !== fn); };
}
