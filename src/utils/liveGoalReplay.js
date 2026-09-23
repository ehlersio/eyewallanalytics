// src/utils/liveGoalReplay.js
// Deciding which goal the live rink offers to replay, and when to ask the
// Worker for it again.
//
// The NHL publishes a goal's player-and-puck tracking some minutes after
// the goal itself, not at the final horn: measured over one night, 56 of 59
// goals had a downloadable replay *during* the game, median 242s (~4 min),
// max 717s (~12 min), 49 of 56 inside five minutes. So the live rink can
// offer a replay mid-game -- but only once it actually exists, never as a
// button that might return nothing.
//
// That means polling, and polling politely: the Worker caches a miss for
// TTL_MISSING (60s), so asking more often than that only burns requests on
// an answer it already has. GIVE_UP_MS covers the slowest goal measured
// with margin; past that a replay almost certainly is not coming (two of
// the three that never arrived were shootout deciders, which the NHL does
// not publish at all).

export const RETRY_MS = 60_000; // matches the Worker's TTL_MISSING
export const GIVE_UP_MS = 15 * 60_000; // slowest measured goal was ~12 min

/**
 * The most recent goal in a play-by-play feed that a replay could exist for.
 *
 * Two gates, both cheap and neither authoritative on its own:
 *
 *   pptReplayUrl -- the play-by-play carries this on a goal (checked against
 *     a real game: all 9 goals had it, no non-goal play did), and it is the
 *     very URL the Worker reads frames from. What is NOT established is
 *     whether the NHL adds it when the goal happens or when the tracking is
 *     actually published; a finished game cannot tell you. So it is used
 *     only to skip goals that can never have a replay, and the Worker fetch
 *     stays the thing that decides a replay really exists. That is correct
 *     whichever way the NHL behaves.
 *
 *   periodType SO -- the NHL publishes no tracking for shootout goals at
 *     all (two of the three goals with no replay in the overnight sample
 *     were shootout deciders), so they would poll forever for nothing.
 *
 * @returns {{eventId: number, scorerId: number|null, period: number|null,
 *            timeInPeriod: string|null}|null}
 */
export function latestReplayableGoal(plays) {
  if (!Array.isArray(plays)) return null;
  for (let i = plays.length - 1; i >= 0; i -= 1) {
    const p = plays[i];
    if (p?.typeDescKey !== 'goal') continue;
    if (p?.eventId == null) continue;
    if (p?.periodDescriptor?.periodType === 'SO') continue;
    if (!p?.pptReplayUrl) continue;
    return {
      eventId: p.eventId,
      scorerId: p.details?.scoringPlayerId ?? null,
      period: p.periodDescriptor?.number ?? null,
      timeInPeriod: p.timeInPeriod ?? null,
    };
  }
  return null;
}

/**
 * Should we ask the Worker for this goal's replay right now?
 * `entry` is what trackFetch() below returns, or undefined if never asked.
 */
export function shouldFetch(entry, now = Date.now()) {
  if (!entry) return true;
  if (entry.status === 'ready' || entry.status === 'gave-up') return false;
  if (entry.status === 'fetching') return false;
  return now >= entry.nextTryAt;
}

/**
 * Fold one fetch outcome into a goal's tracking entry.
 * @param {object|undefined} entry  previous entry, if any
 * @param {'ready'|'missing'} outcome
 */
export function trackFetch(entry, outcome, now = Date.now()) {
  const firstAskedAt = entry?.firstAskedAt ?? now;
  if (outcome === 'ready') return { status: 'ready', firstAskedAt };
  // Stop asking once a replay is this overdue -- see GIVE_UP_MS.
  if (now - firstAskedAt >= GIVE_UP_MS) return { status: 'gave-up', firstAskedAt };
  return { status: 'missing', firstAskedAt, nextTryAt: now + RETRY_MS };
}

/** Marks an in-flight request so a re-render can't fire a second one. */
export function markFetching(entry, now = Date.now()) {
  return { ...entry, status: 'fetching', firstAskedAt: entry?.firstAskedAt ?? now };
}

/**
 * What the live rink should still be watching, given the replay currently
 * on offer. Once a replay is open it is HELD: the offer comes from a hook
 * that keeps polling and resets on a game-id change, and reading it live
 * meant a transient null pulled a viewer out of a replay mid-watch.
 *
 * @param current the replay being watched, or null
 * @param replayEventId the eventId now on offer, or null
 */
export function nextWatching(current, replayEventId) {
  if (!current) return current;
  // No offer right now -- a gap in the polling, not a reason to stop.
  if (replayEventId == null) return current;
  // The same goal arriving again is not a change.
  if (replayEventId === current.goal?.eventId) return current;
  // A genuinely different, newer goal: stop, so nobody is left looking at
  // an older goal under a newer one's heading.
  return null;
}
