// src/utils/__tests__/liveGoalReplay.test.js
// The live rink offers a goal replay only once one exists, and asks for it
// no more often than the Worker's own miss cache would answer. These cover
// the two ways that goes wrong: offering a control that returns nothing,
// and hammering the Worker for a replay that is never coming.

import { describe, it, expect } from 'vitest';
import {
  GIVE_UP_MS,
  RETRY_MS,
  latestReplayableGoal,
  markFetching,
  shouldFetch,
  trackFetch,
} from '../liveGoalReplay';

const PPT = 'https://wsr.nhle.com/sprites/20252026/2025020500/ev261.json';

const goal = (eventId, extra = {}) => ({
  typeDescKey: 'goal',
  eventId,
  pptReplayUrl: PPT,
  periodDescriptor: { number: 1, periodType: 'REG' },
  timeInPeriod: '12:41',
  details: { scoringPlayerId: 8482737 },
  ...extra,
});

describe('latestReplayableGoal', () => {
  it('picks the most recent goal, not the first', () => {
    const plays = [goal(261), { typeDescKey: 'hit', eventId: 262 }, goal(367)]
    expect(latestReplayableGoal(plays).eventId).toBe(367)
  })

  it('carries what the rink needs to label the control', () => {
    expect(latestReplayableGoal([goal(261)])).toEqual({
      eventId: 261, scorerId: 8482737, period: 1, timeInPeriod: '12:41',
    })
  })

  it('ignores plays that are not goals', () => {
    const plays = [{ typeDescKey: 'shot-on-goal', eventId: 9, pptReplayUrl: PPT }]
    expect(latestReplayableGoal(plays)).toBeNull()
  })

  it('skips a goal with no pptReplayUrl — nothing to fetch frames from', () => {
    expect(latestReplayableGoal([goal(261, { pptReplayUrl: undefined })])).toBeNull()
  })

  it('falls back to an older goal when the newest has no replay url yet', () => {
    const plays = [goal(261), goal(367, { pptReplayUrl: undefined })]
    expect(latestReplayableGoal(plays).eventId).toBe(261)
  })

  it('skips shootout goals — the NHL publishes no tracking for them', () => {
    const so = goal(500, { periodDescriptor: { number: 5, periodType: 'SO' } })
    expect(latestReplayableGoal([so])).toBeNull()
  })

  it('survives a missing or malformed feed', () => {
    expect(latestReplayableGoal(null)).toBeNull()
    expect(latestReplayableGoal(undefined)).toBeNull()
    expect(latestReplayableGoal([])).toBeNull()
    expect(latestReplayableGoal([null, undefined])).toBeNull()
  })
})

describe('shouldFetch', () => {
  const now = 1_000_000

  it('asks for a goal it has never seen', () => {
    expect(shouldFetch(undefined, now)).toBe(true)
  })

  it('does not ask again while a request is in flight', () => {
    expect(shouldFetch(markFetching(undefined, now), now)).toBe(false)
  })

  it('does not ask again once the replay is in hand', () => {
    expect(shouldFetch({ status: 'ready', firstAskedAt: now }, now)).toBe(false)
  })

  it('waits out the retry window after a miss, then asks once', () => {
    const missed = trackFetch(markFetching(undefined, now), 'missing', now)
    expect(shouldFetch(missed, now + RETRY_MS - 1)).toBe(false)
    expect(shouldFetch(missed, now + RETRY_MS)).toBe(true)
  })

  it('stops asking for a replay that is never coming', () => {
    expect(shouldFetch({ status: 'gave-up', firstAskedAt: now }, now + GIVE_UP_MS * 10)).toBe(false)
  })
})

describe('trackFetch', () => {
  const now = 1_000_000

  it('marks a found replay ready', () => {
    expect(trackFetch(undefined, 'ready', now).status).toBe('ready')
  })

  it('schedules the next try one Worker miss-cache later', () => {
    const entry = trackFetch(undefined, 'missing', now)
    expect(entry.status).toBe('missing')
    expect(entry.nextTryAt).toBe(now + RETRY_MS)
  })

  it('keeps the original ask time across retries, so giving up is measured from the first', () => {
    let entry = trackFetch(undefined, 'missing', now)
    entry = trackFetch(entry, 'missing', now + RETRY_MS)
    expect(entry.firstAskedAt).toBe(now)
  })

  it('gives up once a replay is overdue past the slowest one ever measured', () => {
    let entry = trackFetch(undefined, 'missing', now)
    entry = trackFetch(entry, 'missing', now + GIVE_UP_MS)
    expect(entry.status).toBe('gave-up')
  })

  it('still accepts a replay that arrives just before the give-up point', () => {
    let entry = trackFetch(undefined, 'missing', now)
    entry = trackFetch(entry, 'ready', now + GIVE_UP_MS - 1)
    expect(entry.status).toBe('ready')
  })

  it('gives the retry window a full minute of real time', () => {
    // A shorter window would just re-ask inside the Worker's own miss cache
    // (TTL_MISSING = 60s) and get the same answer back.
    expect(RETRY_MS).toBe(60_000)
  })
})
