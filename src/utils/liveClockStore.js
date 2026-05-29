/**
 * liveClockStore — shared live game clock
 *
 * ShotMapView publishes the authoritative clock value when it gets fresh PBP.
 * Both Topbar and ShotMapView derive the current display time from the same
 * sync point using Date.now() arithmetic — no independent intervals to drift.
 *
 * When the game clock is stopped (stoppage in play, faceoff pending, etc.)
 * the clock freezes at the last known value instead of counting down.
 *
 * Usage:
 *   Publisher: publishClock('14:32', false, true)  // time, intermission, running
 *   Consumer:  const { display } = getClockDisplay()  — call in a 1s interval
 */

let _sync = null; // { totalSecs, syncTime, inIntermission, running, raw }
let _subscribers = [];

// ── Momentum store ────────────────────────────────────────────
// ShotMapView publishes rolling shot attempt differential.
// Topbar reads it to show compact momentum bar during live games.
let _momentum = null; // { carPct, oppPct, carShots, oppShots, window, waveData }
let _momentumSubscribers = [];

export function publishMomentum(data) {
  _momentum = data;
  _momentumSubscribers.forEach(fn => fn(data));
}

export function getMomentum() {
  return _momentum;
}

export function subscribeMomentum(fn) {
  _momentumSubscribers.push(fn);
  if (_momentum) fn(_momentum);
  return () => { _momentumSubscribers = _momentumSubscribers.filter(s => s !== fn); };
}

export function publishClock(timeRemaining, inIntermission, running = true) {
  if (!timeRemaining) return;
  const [m, s] = timeRemaining.split(':').map(Number);
  _sync = {
    totalSecs:      m * 60 + (s || 0),
    syncTime:       Date.now(),
    inIntermission: !!inIntermission,
    running:        running !== false, // default true if not provided
    raw:            timeRemaining,
  };
  _subscribers.forEach(fn => fn(_sync));
}

export function getClockDisplay() {
  if (!_sync) return null;

  // Intermission: clock counts down continuously (break timer, not game clock)
  // Don't freeze — let it tick normally from the last synced value
  if (_sync.inIntermission) {
    const elapsed   = Math.floor((Date.now() - _sync.syncTime) / 1000);
    const remaining = Math.max(0, _sync.totalSecs - elapsed);
    const mm = Math.floor(remaining / 60).toString().padStart(2, '0');
    const ss = (remaining % 60).toString().padStart(2, '0');
    return { display: `${mm}:${ss}`, inIntermission: true, running: true };
  }

  // If clock is stopped (stoppage in play), freeze at last known time
  if (!_sync.running) {
    return { display: _sync.raw, inIntermission: false, running: false, stopped: true };
  }

  const elapsed   = Math.floor((Date.now() - _sync.syncTime) / 1000);
  const remaining = Math.max(0, _sync.totalSecs - elapsed);
  const mm = Math.floor(remaining / 60).toString().padStart(2, '0');
  const ss = (remaining % 60).toString().padStart(2, '0');
  return { display: `${mm}:${ss}`, inIntermission: false, running: true, remaining };
}

export function subscribeClock(fn) {
  _subscribers.push(fn);
  if (_sync) fn(_sync); // deliver last known immediately
  return () => { _subscribers = _subscribers.filter(s => s !== fn); };
}

export function clearClock() {
  _sync = null;
}

// ── Mock live game store (dev replay) ────────────────────────
// DevReplayView publishes a mock game object so Topbar shows
// the live score/period without its own getLiveGame poll.
let _mockLiveGame = null;
let _mockLiveGameSubscribers = [];

export function publishMockLiveGame(game) {
  _mockLiveGame = game;
  _mockLiveGameSubscribers.forEach(fn => fn(game));
  // Also sync the clock store period display if period info attached
  if (game?._clock?.timeRemaining) {
    publishClock(game._clock.timeRemaining, false, game._clock.running !== false);
  }
}

export function clearMockLiveGame() {
  _mockLiveGame = null;
  _mockLiveGameSubscribers.forEach(fn => fn(null));
}

export function subscribeMockLiveGame(fn) {
  _mockLiveGameSubscribers.push(fn);
  if (_mockLiveGame) fn(_mockLiveGame);
  return () => { _mockLiveGameSubscribers = _mockLiveGameSubscribers.filter(s => s !== fn); };
}
