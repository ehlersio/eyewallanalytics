// utils/pwhlShotMapStats.js
// Counts behind the PWHL Shot Map's shot cards, from its IceRink events
// (type 'shot-on-goal' | 'goal' | 'blocked-shot').
//
// Shots on goal include goals -- the way HockeyTech's box score, the
// Worker's /pwhl/team-season-summary and the period/game summaries
// (computePWHLShotStats) count them. The card used to count only the
// non-goal shots: OTT in game 328 read 28 where HockeyTech has 31.
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
