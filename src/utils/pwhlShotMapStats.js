// utils/pwhlShotMapStats.js
// Counts behind the PWHL Shot Map's shot cards, from its IceRink events
// (type 'shot-on-goal' | 'goal' | 'blocked-shot').
//
// Shots on goal include goals -- the way HockeyTech's box score, the
// Worker's /pwhl/team-season-summary and the period/game summaries
// (computePWHLShotStats) count them. The card used to count only the
// non-goal shots: OTT in game 328 read 28 where HockeyTech has 31.
import { SHOOTOUT_PERIOD, isShootoutEvent } from './shootout';

export function pwhlShotMapCounts(ourShotEvents, oppShotEvents = []) {
  const count = (events, type) => events.filter(e => e.type === type).length;
  const goals = count(ourShotEvents, 'goal');
  const sog = count(ourShotEvents, 'shot-on-goal') + goals;
  const blocks = count(ourShotEvents, 'blocked-shot');
  return {
    sog,
    blocks,
    goals,
    total: sog + blocks,
    oppSOG: count(oppShotEvents, 'shot-on-goal') + count(oppShotEvents, 'goal'),
    oppBlocked: count(oppShotEvents, 'blocked-shot'),
  };
}

// The live feed (/pwhl/live) sends each goal twice: as a shot event with
// isGoal, and again as a goal event at the same team/period/time. Keep
// the shot (it's the shot on goal), drop the goal event that repeats it;
// a goal event with no matching shot stays.
export function dropRepeatedLiveGoals(events) {
  const key = e => `${e.teamId}|${e.period}|${e.timeSeconds}`;
  const shotGoals = new Set(events.filter(e => e.eventType === 'shot' && e.isGoal).map(key));
  return events.filter(e => e.eventType !== 'goal' || !shotGoals.has(key(e)));
}

// The score card's period and clock from the last /pwhl/live event: { period,
// time }, or null with no events. A shootout attempt (period 7, no clock;
// utils/shootout.js) reads period 7 with no time, which the card labels
// "SO" -- it used to read "OT4".
export function pwhlLiveClock(events) {
  if (!events?.length) return null;
  const last = events[events.length - 1];
  if (isShootoutEvent(last)) return { period: SHOOTOUT_PERIOD, time: null };
  return { period: last.period, time: last.time };
}
