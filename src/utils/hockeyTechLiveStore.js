// utils/hockeyTechLiveStore.js
// The followed PWHL/AHL/ECHL team's live game, for the Topbar's live chip:
// one poller per league and team, shared by every subscriber (the same
// reference-counted shape as liveGameStore.js, the NHL's).
//
// Each tick reads the league's /today (max-age=5 at the Worker). A game of
// the team's that is live: its /live play-by-play is read too, for the
// latest score and the period/clock of the last event (what the shot maps
// show), and the next tick is in 30 s. Nothing live: the next tick is in
// 60 s (hockeyTechTodayInterval's numbers). A push ticks at once.
//
// State: { game, clock, checked } -- game is the /today row (null when
// none), clock { period, time, shootout } from /live (null until read).

import { HOCKEYTECH_TODAY_LIVE_MS, HOCKEYTECH_TODAY_IDLE_MS } from './livePolling';

export const EMPTY_HT_LIVE_STATE = Object.freeze({ game: null, clock: null, checked: false });

// The team's live game in a /today answer, or null.
export function liveGameFor(todayGames, teamId) {
  if (!Array.isArray(todayGames) || teamId == null) return null;
  return todayGames.find(g =>
    (g.homeTeamId === teamId || g.awayTeamId === teamId) && g.status === 'live'
  ) || null;
}

// { period, time, shootout } from the last event of a /live payload.
export function lastEventClock(liveData) {
  const events = liveData?.events;
  if (!events?.length) return null;
  const last = events[events.length - 1];
  return { period: last.period ?? null, time: last.time || null, shootout: last.eventType === 'shootout' };
}

// The chip's numbers, from the followed team's side.
export function chipScore(game, teamId) {
  if (!game) return null;
  const isHome = game.homeTeamId === teamId;
  return {
    myAbbr:   isHome ? game.homeTeamCode : game.awayTeamCode,
    oppAbbr:  isHome ? game.awayTeamCode : game.homeTeamCode,
    myScore:  isHome ? game.homeScore : game.awayScore,
    oppScore: isHome ? game.awayScore : game.homeScore,
  };
}

// "P2", "OT", "2OT", "SO".
export function periodLabel(clock) {
  if (!clock?.period) return null;
  if (clock.shootout) return 'SO';
  const n = clock.period;
  if (n <= 3) return `P${n}`;
  if (n === 4) return 'OT';
  return `${n - 3}OT`;
}

// apis: { [leagueKey]: { fetchToday(), fetchLive(gameId) } }
export function createHockeyTechLiveStore({
  apis, onPushReceived,
  setTimer = (fn, ms) => setTimeout(fn, ms),
  clearTimer = (id) => clearTimeout(id),
}) {
  const pollers = new Map(); // `${key}:${teamId}` -> poller

  const idOf = (key, teamId) => `${key}:${teamId}`;

  function publish(p, state) {
    p.state = state;
    p.listeners.forEach(fn => fn(state));
  }

  function schedule(p, ms) {
    clearTimer(p.timer);
    p.timer = setTimer(() => tick(p), ms);
  }

  async function tick(p) {
    const gen = ++p.gen;
    clearTimer(p.timer);
    p.timer = null;
    const current = () => p.refs > 0 && gen === p.gen;
    const api = apis[p.key];
    try {
      const today = await api.fetchToday();
      if (!current()) return;
      const found = liveGameFor(today, p.teamId);
      if (found) {
        const live = await api.fetchLive(found.gameId).catch(() => null);
        if (!current()) return;
        const sameGame = String(live?.gameId) === String(found.gameId);
        // /live's score is newer than /today's.
        const game = sameGame
          ? { ...found, homeScore: live.homeScore ?? found.homeScore, awayScore: live.awayScore ?? found.awayScore }
          : found;
        // A failed /live keeps the last clock of the same game.
        const clock = (sameGame ? lastEventClock(live) : null)
          ?? (String(p.state.game?.gameId) === String(found.gameId) ? p.state.clock : null);
        publish(p, { game, clock, checked: true });
        schedule(p, HOCKEYTECH_TODAY_LIVE_MS);
      } else {
        if (p.state.game !== null || !p.state.checked) publish(p, { game: null, clock: null, checked: true });
        schedule(p, HOCKEYTECH_TODAY_IDLE_MS);
      }
    } catch {
      if (current()) schedule(p, p.state.game ? HOCKEYTECH_TODAY_LIVE_MS : HOCKEYTECH_TODAY_IDLE_MS);
    }
  }

  function subscribe(key, teamId, listener) {
    if (!apis[key] || teamId == null) return () => {};
    const id = idOf(key, teamId);
    let p = pollers.get(id);
    if (!p) {
      p = { key, teamId, refs: 0, listeners: new Set(), state: EMPTY_HT_LIVE_STATE, timer: null, gen: 0, offPush: null };
      pollers.set(id, p);
    }
    p.listeners.add(listener);
    p.refs += 1;
    if (p.refs === 1) {
      p.offPush = onPushReceived?.(() => tick(p)) ?? null;
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
        p.gen += 1;
        p.offPush?.();
        p.offPush = null;
        p.state = EMPTY_HT_LIVE_STATE;
      }
    };
  }

  function getSnapshot(key, teamId) {
    return pollers.get(idOf(key, teamId))?.state ?? EMPTY_HT_LIVE_STATE;
  }

  return { subscribe, getSnapshot };
}
