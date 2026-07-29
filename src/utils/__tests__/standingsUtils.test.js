// src/utils/__tests__/standingsUtils.test.js
// Unit tests for the shared standings-staleness check used by ScheduleView,
// TeamView, LeagueView, and PlayersView.

import { describe, it, expect } from 'vitest'
import { isStandingsStale } from '../standingsUtils.js'

describe('isStandingsStale', () => {
  it('is false when seasonId matches the resolved season', () => {
    expect(isStandingsStale([{ seasonId: 20262027 }], '20262027')).toBe(false)
  })

  it('is true when seasonId is an explicit mismatch (last season still pinned)', () => {
    expect(isStandingsStale([{ seasonId: 20252026 }], '20262027')).toBe(true)
  })

  it('coerces both sides to string before comparing', () => {
    expect(isStandingsStale([{ seasonId: 20262027 }], 20262027)).toBe(false)
  })

  it('is false when seasonId is absent — not evidence of staleness (e.g. a test stub)', () => {
    expect(isStandingsStale([{ points: 100 }], '20262027')).toBe(false)
  })

  it('is false for an empty or missing standings array', () => {
    expect(isStandingsStale([], '20262027')).toBe(false)
    expect(isStandingsStale(null, '20262027')).toBe(false)
    expect(isStandingsStale(undefined, '20262027')).toBe(false)
  })
})
