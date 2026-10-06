// utils/liveGameStore.js
// One live-game poller per team, shared by everything that shows that
// team's live game: the Topbar's score chip and the shot map. Each used to
// run its own poll (Topbar every 10 s, ShotMapView every 20 s) and each
// busted the play-by-play and schedule caches before reading them, so the
// two unsynchronised timers defeated each other's caching: ~5 Worker hits
// per 10 s per client during a game, and the 184 KB schedule re-downloaded
// every tick (audit 2026-10-06 §6, app-perf 1.2).
//
// Reference-counted: the first subscriber for a team starts its poller, the
// last one to leave stops it. A guest game view (GameTeamContext.jsx)
// subscribes with the guest team and gets that team's own poller.
//
// Each tick: getLiveGame(team) (the schedule, through nhlApi's 20 s cache).
// A live game: its play-by-play and box score caches are busted and the
// play-by-play is fetched, and the next tick is in 10 s. Nothing live: the
// next tick is livePollInterval(schedule) -- tighter as puck drop nears.
// A push (usually Game Starting) re-reads the schedule and ticks now.

import {
  getLiveGame, getAllGames, getGameDetail, bustLiveGameCache, bustScheduleCache,
} from './nhlApi';
import { livePollInterval, onPushReceived } from './livePolling';

export const LIVE_POLL_MS = 10_000;

// game: the live game as getLiveGame returns it (null when none);
// pbp: that game's play-by-play (null until fetched);
// checked: a poll has answered since this poller started.
export const EMPTY_LIVE_STATE = Object.freeze({ game: null, pbp: null, checked: false });

const sameId = (a, b) => a != null && b != null && String(a) === String(b);

// Dependencies are injected so tests can drive the poller with fakes; the
// app uses `liveGameStore` below (hooks/useLiveGame.js).
export function createLiveGameStore({
  getLiveGame, getAllGames, getGameDetail, bustLiveGameCache, bustScheduleCache,
  livePollInterval, onPushReceived,
  setTimer = (fn, ms) => setTimeout(fn, ms),
  clearTimer = (id) => clearTimeout(id),
}) {
  const pollers = new Map(); // team abbr -> poller

  function pollerFor(team) {
    let p = pollers.get(team.abbr);
    if (!p) {
      p = { team, refs: 0, listeners: new Set(), state: EMPTY_LIVE_STATE, timer: null, gen: 0, offPush: null, lastInterval: 60_000 };
      pollers.set(team.abbr, p);
    }
    return p;
  }

  function publish(p, state) {
    p.state = state;
    p.listeners.forEach(fn => fn(state));
  }

  function schedule(p, ms) {
    clearTimer(p.timer);
    p.lastInterval = ms;
    p.timer = setTimer(() => tick(p), ms);
  }

  async function tick(p) {
    // A newer tick (a push, the app coming back) or a stop supersedes this one.
    const gen = ++p.gen;
    clearTimer(p.timer);
    p.timer = null;
    const current = () => p.refs > 0 && gen === p.gen;
    try {
      const found = await getLiveGame(p.team);
      if (!current()) return;
      const game = found?.id ? found : null;
      if (game) {
        // Fresh play-by-play and box score for the live game. Not the
        // schedule: getAllGames' 20 s cache is fresh enough to see the game
        // end, and re-reading it every tick was the 184 KB re-download.
        bustLiveGameCache(game.id, p.team);
        const pbp = await getGameDetail(game.id).catch(() => null);
        if (!current()) return;
        // A failed read keeps the last play-by-play of the same game rather
        // than blanking the rink.
        const keep = pbp ?? (sameId(p.state.pbp?.id, game.id) ? p.state.pbp : null);
        publish(p, { game, pbp: keep, checked: true });
        schedule(p, LIVE_POLL_MS);
      } else {
        if (p.state.game !== null || !p.state.checked) publish(p, { game: null, pbp: null, checked: true });
        // getLiveGame just read the schedule, so this is its cached copy.
        const games = await getAllGames(p.team).catch(() => null);
        if (!current()) return;
        schedule(p, livePollInterval(games, false));
      }
    } catch {
      if (current()) schedule(p, p.lastInterval);
    }
  }

  function subscribe(team, listener) {
    const p = pollerFor(team);
    // The first subscriber's team object is the one polled with (the
    // favorite's TEAM_CONFIG keeps its live `season` getter).
    if (p.refs === 0) p.team = team;
    p.listeners.add(listener);
    p.refs += 1;
    if (p.refs === 1) {
      p.offPush = onPushReceived(() => refresh(team, { bustSchedule: true }));
      tick(p);
    }
    let subscribed = true;
    return () => {
      if (!subscribed) return;
      subscribed = false;
      p.listeners.delete(listener);
      p.refs -= 1;
      if (p.refs === 0) {
        clearTimer(p.timer);
        p.timer = null;
        p.gen += 1; // drop any tick still in flight
        p.offPush?.();
        p.offPush = null;
        p.state = EMPTY_LIVE_STATE;
      }
    };
  }

  function getSnapshot(team) {
    return pollers.get(team?.abbr)?.state ?? EMPTY_LIVE_STATE;
  }

  // Check now instead of at the next tick. bustSchedule: re-read the
  // schedule past its 20 s copy -- a game may have just gone live (a push,
  // the app returning from the background).
  function refresh(team, { bustSchedule = false } = {}) {
    const p = pollers.get(team?.abbr);
    if (!p || p.refs === 0) return;
    if (bustSchedule) bustScheduleCache(p.team);
    tick(p);
  }

  function activePollers() {
    return [...pollers.values()].filter(p => p.refs > 0).map(p => p.team.abbr);
  }

  return { subscribe, getSnapshot, refresh, activePollers };
}

export const liveGameStore = createLiveGameStore({
  getLiveGame, getAllGames, getGameDetail, bustLiveGameCache, bustScheduleCache,
  livePollInterval, onPushReceived,
});
