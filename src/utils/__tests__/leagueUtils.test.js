// src/utils/__tests__/leagueUtils.test.js
// Unit tests for pure grouping/sorting functions used by LeagueView.
// These are extracted from LeagueView.jsx for testability — if you haven't
// exported them yet, see the note at the bottom of this file.

import { describe, it, expect } from 'vitest'
import {
  groupByDivision,
  groupByConference,
  buildWildCard,
} from '../leagueUtils.js'

// ── Fixtures ──────────────────────────────────────────────────

function makeTeam(overrides) {
  return {
    teamAbbrev:          { default: 'TST' },
    conferenceName:      'Eastern',
    divisionName:        'Atlantic',
    divisionSequence:    1,
    conferenceSequence:  1,
    leagueSequence:      1,
    wildcardSequence:    99,
    points:              100,
    wins:                50,
    losses:              20,
    otLosses:            12,
    gamesPlayed:         82,
    l10Wins:             7,
    l10Losses:           2,
    l10OtLosses:         1,
    streakCode:          'W3',
    clinchIndicator:     null,
    ...overrides,
  }
}

const METRO_1 = makeTeam({ teamAbbrev: { default: 'CAR' }, divisionName: 'Metropolitan', divisionSequence: 1, conferenceSequence: 1, leagueSequence: 1,  wildcardSequence: 99, points: 113 })
const METRO_2 = makeTeam({ teamAbbrev: { default: 'PIT' }, divisionName: 'Metropolitan', divisionSequence: 2, conferenceSequence: 2, leagueSequence: 3,  wildcardSequence: 99, points: 98  })
const METRO_3 = makeTeam({ teamAbbrev: { default: 'PHI' }, divisionName: 'Metropolitan', divisionSequence: 3, conferenceSequence: 3, leagueSequence: 5,  wildcardSequence: 99, points: 95  })
const METRO_4 = makeTeam({ teamAbbrev: { default: 'NYR' }, divisionName: 'Metropolitan', divisionSequence: 4, conferenceSequence: 5, leagueSequence: 8,  wildcardSequence: 1,  points: 90  })
const METRO_5 = makeTeam({ teamAbbrev: { default: 'WSH' }, divisionName: 'Metropolitan', divisionSequence: 5, conferenceSequence: 6, leagueSequence: 9,  wildcardSequence: 2,  points: 88  })
const ATL_1   = makeTeam({ teamAbbrev: { default: 'BOS' }, divisionName: 'Atlantic',     divisionSequence: 1, conferenceSequence: 4, leagueSequence: 6,  wildcardSequence: 99, points: 92  })
const ATL_2   = makeTeam({ teamAbbrev: { default: 'TOR' }, divisionName: 'Atlantic',     divisionSequence: 2, conferenceSequence: 7, leagueSequence: 11, wildcardSequence: 99, points: 85  })
const ATL_3   = makeTeam({ teamAbbrev: { default: 'TBL' }, divisionName: 'Atlantic',     divisionSequence: 3, conferenceSequence: 8, leagueSequence: 12, wildcardSequence: 99, points: 82  })
const ATL_4   = makeTeam({ teamAbbrev: { default: 'FLA' }, divisionName: 'Atlantic',     divisionSequence: 4, conferenceSequence: 9, leagueSequence: 14, wildcardSequence: 3,  points: 78  })

const WEST_1  = makeTeam({ teamAbbrev: { default: 'COL' }, conferenceName: 'Western', divisionName: 'Central',  divisionSequence: 1, conferenceSequence: 1, leagueSequence: 2,  wildcardSequence: 99, points: 110 })
const WEST_2  = makeTeam({ teamAbbrev: { default: 'VGK' }, conferenceName: 'Western', divisionName: 'Pacific',  divisionSequence: 1, conferenceSequence: 2, leagueSequence: 4,  wildcardSequence: 99, points: 96  })
const WEST_3  = makeTeam({ teamAbbrev: { default: 'EDM' }, conferenceName: 'Western', divisionName: 'Pacific',  divisionSequence: 2, conferenceSequence: 3, leagueSequence: 7,  wildcardSequence: 1,  points: 91  })

const ALL_EAST = [METRO_1, METRO_2, METRO_3, METRO_4, METRO_5, ATL_1, ATL_2, ATL_3, ATL_4]
const ALL      = [...ALL_EAST, WEST_1, WEST_2, WEST_3]

// ── groupByDivision ───────────────────────────────────────────

describe('groupByDivision', () => {
  it('groups teams into correct division buckets', () => {
    const result = groupByDivision(ALL_EAST)
    expect(Object.keys(result)).toContain('Metropolitan')
    expect(Object.keys(result)).toContain('Atlantic')
    expect(result['Metropolitan'].rows).toHaveLength(5)
    expect(result['Atlantic'].rows).toHaveLength(4)
  })

  it('attaches the correct conferenceName to each division', () => {
    const result = groupByDivision(ALL_EAST)
    expect(result['Metropolitan'].conf).toBe('Eastern')
    expect(result['Atlantic'].conf).toBe('Eastern')
  })

  it('sorts each division by divisionSequence ascending', () => {
    const result = groupByDivision(ALL_EAST)
    const metroAbbrevs = result['Metropolitan'].rows.map(r => r.teamAbbrev.default)
    expect(metroAbbrevs).toEqual(['CAR', 'PIT', 'PHI', 'NYR', 'WSH'])
  })

  it('handles an empty array', () => {
    const result = groupByDivision([])
    expect(Object.keys(result)).toHaveLength(0)
  })

  it('handles a single team', () => {
    const result = groupByDivision([METRO_1])
    expect(result['Metropolitan'].rows).toHaveLength(1)
  })
})

// ── groupByConference ─────────────────────────────────────────

describe('groupByConference', () => {
  it('groups teams into Eastern and Western buckets', () => {
    const result = groupByConference(ALL)
    expect(Object.keys(result)).toContain('Eastern')
    expect(Object.keys(result)).toContain('Western')
  })

  it('Eastern bucket has correct team count', () => {
    const result = groupByConference(ALL)
    expect(result['Eastern']).toHaveLength(9)
  })

  it('sorts each conference by conferenceSequence ascending', () => {
    const result = groupByConference(ALL_EAST)
    const abbrevs = result['Eastern'].map(r => r.teamAbbrev.default)
    // METRO_1 conferenceSeq=1, METRO_2=2, METRO_3=3, ATL_1=4, METRO_4=5...
    expect(abbrevs[0]).toBe('CAR')
    expect(abbrevs[1]).toBe('PIT')
    expect(abbrevs[2]).toBe('PHI')
    expect(abbrevs[3]).toBe('BOS')
  })

  it('handles an empty array', () => {
    const result = groupByConference([])
    expect(Object.keys(result)).toHaveLength(0)
  })
})

// ── buildWildCard ─────────────────────────────────────────────

describe('buildWildCard', () => {
  it('separates division leaders (seq <= 3) from wild card pool', () => {
    const result = buildWildCard(ALL_EAST)
    // Metro div leaders: CAR(1), PIT(2), PHI(3)
    // Atlantic div leaders: BOS(1), TOR(2), TBL(3)
    // WC pool: NYR(4), WSH(5), FLA(4)
    expect(result['Eastern'].divLeaders['Metropolitan']).toHaveLength(3)
    expect(result['Eastern'].divLeaders['Atlantic']).toHaveLength(3)
    expect(result['Eastern'].wcPool).toHaveLength(3)
  })

  it('wild card pool is sorted by wildcardSequence ascending', () => {
    const result = buildWildCard(ALL_EAST)
    const wcAbbrevs = result['Eastern'].wcPool.map(r => r.teamAbbrev.default)
    // NYR wildcardSeq=1, WSH=2, FLA=3
    expect(wcAbbrevs).toEqual(['NYR', 'WSH', 'FLA'])
  })

  it('division leaders are sorted by divisionSequence within their division', () => {
    const result = buildWildCard(ALL_EAST)
    const metroAbbrevs = result['Eastern'].divLeaders['Metropolitan'].map(r => r.teamAbbrev.default)
    expect(metroAbbrevs).toEqual(['CAR', 'PIT', 'PHI'])
  })

  it('separates Eastern and Western conferences', () => {
    const result = buildWildCard(ALL)
    expect(Object.keys(result)).toContain('Eastern')
    expect(Object.keys(result)).toContain('Western')
  })

  it('handles empty array', () => {
    const result = buildWildCard([])
    expect(Object.keys(result)).toHaveLength(0)
  })

  it('a team with divisionSequence exactly 3 is a division leader, not WC', () => {
    const result = buildWildCard(ALL_EAST)
    const wcAbbrevs = result['Eastern'].wcPool.map(r => r.teamAbbrev.default)
    // TBL has divisionSequence=3 — should NOT be in wcPool
    expect(wcAbbrevs).not.toContain('TBL')
    expect(result['Eastern'].divLeaders['Atlantic'].map(r => r.teamAbbrev.default)).toContain('TBL')
  })
})

/*
 * NOTE — extracting pure functions for testability
 * ─────────────────────────────────────────────────
 * The grouping functions above live inside LeagueView.jsx right now.
 * To make them importable here, move them to a new file:
 *
 *   src/utils/leagueUtils.js
 *
 * and export them:
 *
 *   export function groupByDivision(entries) { ... }
 *   export function groupByConference(entries) { ... }
 *   export function buildWildCard(entries) { ... }
 *
 * Then import them in LeagueView.jsx:
 *
 *   import { groupByDivision, groupByConference, buildWildCard } from '../utils/leagueUtils'
 *
 * No logic changes needed — it's a pure extraction.
 */
