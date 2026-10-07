// utils/livePolling.js
// How often to re-check the schedule for a live game, and the signal that
// a push just arrived (so the check runs now instead).
//
// The interval used to be worked out once, when the shot map mounted: a
// view opened more than 3 hours ahead polled every 5 minutes right through
// puck drop, and one past its game's start time looked ahead to the next
// game. It's now asked again before every poll, and polls every 20s from
// just before the scheduled start until the game shows up live.

const DONE = ['OFF', 'FINAL', 'F', 'FINAL_OVERTIME', 'FINAL_SHOOTOUT'];
// A game this far past its start that still isn't live was postponed or
// is a stale copy; it shouldn't hold polling at 20s.
const STALE_START_MINS = 45;

export function livePollInterval(games, isLive, now = Date.now()) {
  if (isLive) return 20_000;
  if (!games) return 60_000;                     // schedule not loaded yet
  let soonest = Infinity;
  for (const g of games) {
    if (!g.startTimeUTC || DONE.includes(g.gameState)) continue;
    const mins = (Date.parse(g.startTimeUTC) - now) / 60_000;
    if (mins < -STALE_START_MINS) continue;
    soonest = Math.min(soonest, mins);
  }
  if (soonest === Infinity) return 30 * 60_000;  // offseason / nothing ahead
  if (soonest <= 5) return 20_000;               // puck drop any moment
  if (soonest < 180) return 60_000;              // within 3hrs
  return 5 * 60_000;                             // between games
}

// The HockeyTech shot maps' "/today" live-detection poll: every 60s until a
// game for the team is live, every 30s from then on. Returns a function for
// usePoll to ask before every tick, reading the view's `isLiveRef` each time.
// Each view used to compute the number once at mount (`useMemo(..., [])`),
// when the ref is still false, so the 30s poll never happened.
export const HOCKEYTECH_TODAY_LIVE_MS = 30_000;
export const HOCKEYTECH_TODAY_IDLE_MS = 60_000;

export function hockeyTechTodayInterval(isLiveRef) {
  return () => (isLiveRef.current ? HOCKEYTECH_TODAY_LIVE_MS : HOCKEYTECH_TODAY_IDLE_MS);
}

// A push (iOS foreground, or the web service worker) means the poller just
// saw something change -- usually a game going live.
export const PUSH_RECEIVED = 'eyewall:push-received';

export function onPushReceived(fn) {
  window.addEventListener(PUSH_RECEIVED, fn);
  return () => window.removeEventListener(PUSH_RECEIVED, fn);
}

export function signalPushReceived() {
  window.dispatchEvent(new window.Event(PUSH_RECEIVED));
}
