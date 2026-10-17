// utils/hockeyTechLiveStore.js
// A PWHL/AHL/ECHL team's live game, for the Topbar's live chip and the
// AHL/ECHL Shot Map (the followed team's, or a guest team's in
// HockeyTechGuestGameView): one poller per league and team, shared by every
// subscriber (the same reference-counted shape as liveGameStore.js, the
// NHL's).
//
// Each tick reads the league's /today (max-age=5 at the Worker). A game of
// the team's that is live: its /live play-by-play is read too, for the
// latest score and the event popups, and the next tick is in 30 s. Nothing
// live: the next tick is in 60 s (hockeyTechTodayInterval's numbers). A
// push, or refresh() (the app coming back into view), ticks at once.
//
// The period, clock and intermission come from /today's row: the Worker
// reads them off HockeyTech's scorebar (period, periodType, periodLabel,
// clock, inIntermission; a snapshot up to 60 s old, not a running clock,
// so nothing here ticks it). An older Worker sends none of those keys; the
// clock then falls back to the period/time of the last /live event.
//
// State: { game, clock, live, checked } -- game is the /today row (null
// when none), clock { period, time, shootout, label?, inIntermission? }
// (null until known), live the /live payload itself (the Shot Map's event
// popups read its events; null until read).

import { HOCKEYTECH_TODAY_LIVE_MS, HOCKEYTECH_TODAY_IDLE_MS } from './livePolling';

export const EMPTY_HT_LIVE_STATE = Object.freeze({ game: null, clock: null, live: null, checked: false });

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

// The clock from a /today row's scorebar fields: { period, time, shootout,
// label, inIntermission }. null from an older Worker (none of the keys) or
// when the row says neither the period nor the clock.
const SCOREBAR_KEYS = ['period', 'periodType', 'periodLabel', 'clock', 'inIntermission'];
export function scorebarClock(game) {
  if (!game || !SCOREBAR_KEYS.some(k => game[k] !== undefined)) return null;
  const label = typeof game.periodLabel === 'string' && game.periodLabel ? game.periodLabel : null;
  const period = typeof game.period === 'number' && game.period > 0 ? game.period : null;
  const time = game.clock || null;
  const shootout = game.periodType === 'SO' || label === 'SO';
  if (!period && !label && !time && !shootout) return null;
  return { period, time, shootout, label, inIntermission: !!game.inIntermission };
}

// The clock's period number, from the Worker's label when it sent no
// number ("2nd" -> 2, "OT" -> 4, "2OT" -> 5); null in a shootout or when
// unknown.
export function clockPeriodNumber(clock) {
  if (!clock || clock.shootout) return null;
  if (clock.period) return clock.period;
  const m = /^(?:([1-3])(?:st|nd|rd)|(\d*)OT)$/.exec(clock.label || '');
  if (!m) return null;
  return m[1] ? Number(m[1]) : 3 + (m[2] ? Number(m[2]) : 1);
}

// "P2", "OT", "2OT", "SO" (or the Worker's label as it is, when it's none
// of those).
export function periodLabel(clock) {
  if (!clock) return null;
  if (clock.shootout) return 'SO';
  const n = clockPeriodNumber(clock);
  if (!n) return clock.label || null;
  if (n <= 3) return `P${n}`;
  if (n === 4) return 'OT';
  return `${n - 3}OT`;
}

// The Topbar chip's period and time: "P2" + "07:58" in play; "2nd INT"
// (or "OT INT", "2OT INT") and no time in an intermission; "SO" and no
// time in a shootout.
export function chipClock(clock) {
  if (!clock) return { period: null, time: null };
  if (clock.shootout) return { period: 'SO', time: null };
  const label = periodLabel(clock);
  if (clock.inIntermission) {
    if (!label) return { period: null, time: null };
    const ordinal = ['1st', '2nd', '3rd'][clockPeriodNumber(clock) - 1];
    return { period: `${ordinal || label} INT`, time: null };
  }
  return { period: label, time: clock.time || null };
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
        // /today's scorebar clock; from an older Worker, the last event's.
        // A failed /live keeps the last clock of the same game.
        const wasSameGame = String(p.state.game?.gameId) === String(found.gameId);
        const clock = scorebarClock(found)
          ?? (sameGame ? lastEventClock(live) : null)
          ?? (wasSameGame ? p.state.clock : null);
        // ... and its last play-by-play.
        const liveData = sameGame ? live : (wasSameGame ? p.state.live : null);
        publish(p, { game, clock, live: liveData, checked: true });
        schedule(p, HOCKEYTECH_TODAY_LIVE_MS);
      } else {
        if (p.state.game !== null || !p.state.checked) publish(p, { game: null, clock: null, live: null, checked: true });
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

  // Check now rather than on the next tick (the app back from the
  // background, where the browser may have throttled the timer). Only a
  // poller someone is subscribed to.
  function refresh(key, teamId) {
    const p = pollers.get(idOf(key, teamId));
    if (p && p.refs > 0) tick(p);
  }

  return { subscribe, getSnapshot, refresh };
}
