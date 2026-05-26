/**
 * liveClockStore — shared live game clock
 *
 * ShotMapView publishes the authoritative clock value when it gets fresh PBP.
 * Both Topbar and ShotMapView derive the current display time from the same
 * sync point using Date.now() arithmetic — no independent intervals to drift.
 *
 * Usage:
 *   Publisher: publishClock('14:32', false)
 *   Consumer:  const { mm, ss } = getClockDisplay()  — call this in a 1s interval
 */

let _sync = null; // { totalSecs, syncTime, inIntermission, raw }
let _subscribers = [];

export function publishClock(timeRemaining, inIntermission) {
  if (!timeRemaining) return;
  const [m, s] = timeRemaining.split(':').map(Number);
  _sync = {
    totalSecs:      m * 60 + (s || 0),
    syncTime:       Date.now(),
    inIntermission: !!inIntermission,
    raw:            timeRemaining,
  };
  _subscribers.forEach(fn => fn(_sync));
}

export function getClockDisplay() {
  if (!_sync) return null;
  if (_sync.inIntermission) return { display: _sync.raw, inIntermission: true };
  const elapsed   = Math.floor((Date.now() - _sync.syncTime) / 1000);
  const remaining = Math.max(0, _sync.totalSecs - elapsed);
  const mm = Math.floor(remaining / 60).toString().padStart(2, '0');
  const ss = (remaining % 60).toString().padStart(2, '0');
  return { display: `${mm}:${ss}`, inIntermission: false, remaining };
}

export function subscribeClock(fn) {
  _subscribers.push(fn);
  if (_sync) fn(_sync); // deliver last known immediately
  return () => { _subscribers = _subscribers.filter(s => s !== fn); };
}

export function clearClock() {
  _sync = null;
}
