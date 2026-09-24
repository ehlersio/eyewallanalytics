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

// createClockStore() makes one clock + momentum pair. The exports below are
// the app-wide one the Topbar reads, so the favorite's game view and the
// Topbar stay in step. A game view watching someone else's game (see
// GameTeamContext.jsx) makes a private store instead: publishing a guest
// game's clock here would show it under the favorite's score in the Topbar.
export function createClockStore() {
  let sync = null; // { totalSecs, syncTime, inIntermission, running, raw }
  let subscribers = [];

  // ── Momentum ─────────────────────────────────────────────────
  // ShotMapView publishes rolling shot attempt differential.
  // Topbar reads it to show compact momentum bar during live games.
  let momentum = null; // { carPct, oppPct, carShots, oppShots, window, waveData }
  let momentumSubscribers = [];

  function publishMomentum(data) {
    momentum = data;
    momentumSubscribers.forEach(fn => fn(data));
  }

  function getMomentum() {
    return momentum;
  }

  function subscribeMomentum(fn) {
    momentumSubscribers.push(fn);
    if (momentum) fn(momentum);
    return () => { momentumSubscribers = momentumSubscribers.filter(s => s !== fn); };
  }

  function publishClock(timeRemaining, inIntermission, running = true) {
    if (!timeRemaining) return;
    const [m, s] = timeRemaining.split(':').map(Number);
    sync = {
      totalSecs:      m * 60 + (s || 0),
      syncTime:       Date.now(),
      inIntermission: !!inIntermission,
      running:        running !== false, // default true if not provided
      raw:            timeRemaining,
    };
    subscribers.forEach(fn => fn(sync));
  }

  function getClockDisplay() {
    if (!sync) return null;

    // Intermission: clock counts down continuously (break timer, not game clock)
    // Don't freeze — let it tick normally from the last synced value
    if (sync.inIntermission) {
      const elapsed   = Math.floor((Date.now() - sync.syncTime) / 1000);
      const remaining = Math.max(0, sync.totalSecs - elapsed);
      const mm = Math.floor(remaining / 60).toString().padStart(2, '0');
      const ss = (remaining % 60).toString().padStart(2, '0');
      return { display: `${mm}:${ss}`, inIntermission: true, running: true };
    }

    // If clock is stopped (stoppage in play), freeze at last known time
    if (!sync.running) {
      return { display: sync.raw, inIntermission: false, running: false, stopped: true };
    }

    const elapsed   = Math.floor((Date.now() - sync.syncTime) / 1000);
    const remaining = Math.max(0, sync.totalSecs - elapsed);
    const mm = Math.floor(remaining / 60).toString().padStart(2, '0');
    const ss = (remaining % 60).toString().padStart(2, '0');
    return { display: `${mm}:${ss}`, inIntermission: false, running: true, remaining };
  }

  function subscribeClock(fn) {
    subscribers.push(fn);
    if (sync) fn(sync); // deliver last known immediately
    return () => { subscribers = subscribers.filter(s => s !== fn); };
  }

  function clearClock() {
    sync = null;
  }

  return {
    publishMomentum, getMomentum, subscribeMomentum,
    publishClock, getClockDisplay, subscribeClock, clearClock,
  };
}

export const sharedClockStore = createClockStore();
export const {
  publishMomentum, getMomentum, subscribeMomentum,
  publishClock, getClockDisplay, subscribeClock, clearClock,
} = sharedClockStore;

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
