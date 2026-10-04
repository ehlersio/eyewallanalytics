// src/utils/__tests__/leagueUtils.test.js
// Unit tests for pure grouping/sorting functions used by LeagueView.
// These are extracted from LeagueView.jsx for testability — if you haven't
// exported them yet, see the note at the bottom of this file.

import { describe, it, expect } from 'vitest'
import {
  groupByDivision,
  groupByConference,
  buildWildCard,
  projectNhlBracket,
  parseNhlBracket,
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

// ── Playoff bracket ───────────────────────────────────────────

// One conference's standings rows: `divs` maps division abbrev -> team
// abbrevs in division order; `confOrder` is the conference ranking and
// `wcOrder` the wild-card order of everyone outside each division's top 3.
function confRows(conf, divs, confOrder, wcOrder, gp = 5) {
  return Object.entries(divs).flatMap(([div, teams]) => teams.map((abbr, i) => ({
    teamAbbrev: { default: abbr }, conferenceAbbrev: conf, divisionAbbrev: div,
    divisionSequence: i + 1,
    conferenceSequence: confOrder.indexOf(abbr) + 1,
    wildcardSequence: i < 3 ? 0 : wcOrder.indexOf(abbr) + 1,
    gamesPlayed: gp, clinchIndicator: abbr === 'CAR' ? 'x' : undefined,
  })))
}
const EAST_DIVS = {
  A: ['BUF', 'TBL', 'MTL', 'BOS', 'OTT', 'DET', 'FLA', 'TOR'],
  M: ['CAR', 'PIT', 'PHI', 'NJD', 'NYR', 'CBJ', 'WSH', 'NYI'],
}
const WEST_DIVS = {
  C: ['COL', 'DAL', 'MIN', 'UTA', 'WPG', 'NSH', 'STL', 'CHI'],
  P: ['VGK', 'EDM', 'ANA', 'LAK', 'SEA', 'SJS', 'CGY', 'VAN'],
}

describe('projectNhlBracket', () => {
  const standings = ({ eastFirst = 'CAR', gp = 5 } = {}) => [
    ...confRows('E', EAST_DIVS,
      [eastFirst, ...['CAR', 'BUF', 'TBL', 'PIT', 'MTL', 'PHI', 'BOS', 'OTT'].filter(t => t !== eastFirst)],
      ['BOS', 'OTT', 'NJD', 'NYR', 'DET', 'CBJ', 'FLA', 'WSH', 'TOR', 'NYI'], gp),
    ...confRows('W', WEST_DIVS,
      ['COL', 'VGK', 'DAL', 'EDM', 'MIN', 'ANA', 'LAK', 'UTA'],
      ['LAK', 'UTA', 'WPG', 'SEA', 'NSH', 'SJS', 'STL', 'CGY', 'CHI', 'VAN'], gp),
  ]

  it('seeds the top 3 per division and two wild cards per conference', () => {
    const b = projectNhlBracket(standings())
    expect(b.projected).toBe(true)
    expect(b.east[0].series.map(s => [s.top, s.bottom])).toEqual([
      ['BUF', 'BOS'], ['TBL', 'MTL'], // Atlantic: BUF is the 2nd-best winner -> WC1
      ['CAR', 'OTT'], ['PIT', 'PHI'], // Metropolitan: CAR ranks 1st -> WC2
    ])
    expect(b.west[0].series.map(s => [s.top, s.bottom])).toEqual([
      ['COL', 'UTA'], ['DAL', 'MIN'],
      ['VGK', 'LAK'], ['EDM', 'ANA'],
    ])
  })

  it('gives WC2 to whichever division winner ranks higher in the conference', () => {
    const b = projectNhlBracket(standings({ eastFirst: 'BUF' }))
    expect(b.east[0].series[0]).toMatchObject({ top: 'BUF', bottom: 'OTT', bottomSeed: 'WC2' })
    expect(b.east[0].series[2]).toMatchObject({ top: 'CAR', bottom: 'BOS', bottomSeed: 'WC1' })
  })

  it('carries seeds and clinch markers, and leaves later rounds undecided', () => {
    const b = projectNhlBracket(standings())
    expect(b.east[0].series[2]).toMatchObject({ topSeed: 'D1', bottomSeed: 'WC2', topClinch: 'x', topWins: 0, bottomWins: 0 })
    expect(b.east[0].series[3]).toMatchObject({ topSeed: 'D2', bottomSeed: 'D3' })
    expect(b.east.slice(1).map(r => r.series)).toEqual([[null, null], [null]])
    expect(b.final).toBeNull()
  })

  it('is null before anyone has played, or without a full field', () => {
    expect(projectNhlBracket(standings({ gp: 0 }))).toBeNull()
    expect(projectNhlBracket(standings().filter(e => e.conferenceAbbrev === 'E'))).toBeNull()
    expect(projectNhlBracket([])).toBeNull()
    expect(projectNhlBracket(null)).toBeNull()
  })
})

describe('parseNhlBracket', () => {
  const s = (letter, round, top, bottom, tw, bw) => ({
    seriesLetter: letter, playoffRound: round,
    topSeedTeam: { abbrev: top }, bottomSeedTeam: { abbrev: bottom },
    topSeedWins: tw, bottomSeedWins: bw, topSeedRankAbbrev: 'D1', bottomSeedRankAbbrev: 'WC1',
  })
  // The real 2026 playoffs (/playoff-bracket/2026).
  const RAW_2026 = { series: [
    s('A', 1, 'BUF', 'BOS', 4, 2), s('B', 1, 'TBL', 'MTL', 3, 4), s('C', 1, 'CAR', 'OTT', 4, 0), s('D', 1, 'PIT', 'PHI', 2, 4),
    s('E', 1, 'COL', 'LAK', 4, 0), s('F', 1, 'DAL', 'MIN', 2, 4), s('G', 1, 'VGK', 'UTA', 4, 2), s('H', 1, 'EDM', 'ANA', 2, 4),
    s('I', 2, 'BUF', 'MTL', 3, 4), s('J', 2, 'CAR', 'PHI', 4, 0), s('K', 2, 'COL', 'MIN', 4, 1), s('L', 2, 'VGK', 'ANA', 4, 2),
    s('M', 3, 'CAR', 'MTL', 4, 1), s('N', 3, 'COL', 'VGK', 0, 4), s('O', 4, 'CAR', 'VGK', 4, 2),
  ] }

  it('places each series by its letter', () => {
    const b = parseNhlBracket(RAW_2026)
    expect(b.east[0].series.map(x => x.top)).toEqual(['BUF', 'TBL', 'CAR', 'PIT'])
    expect(b.east[1].series.map(x => `${x.top}-${x.bottom}`)).toEqual(['BUF-MTL', 'CAR-PHI'])
    expect(b.west[2].series[0]).toMatchObject({ top: 'COL', bottom: 'VGK', topWins: 0, bottomWins: 4 })
    expect(b.final).toMatchObject({ top: 'CAR', bottom: 'VGK', topWins: 4, bottomWins: 2 })
  })

  it('leaves rounds not reached yet as open slots', () => {
    const b = parseNhlBracket({ series: RAW_2026.series.filter(x => x.playoffRound === 1) })
    expect(b.east[1].series).toEqual([null, null])
    expect(b.final).toBeNull()
  })

  it('is null when the season has no series yet', () => {
    expect(parseNhlBracket({ series: [] })).toBeNull()
    expect(parseNhlBracket(null)).toBeNull()
  })
})
