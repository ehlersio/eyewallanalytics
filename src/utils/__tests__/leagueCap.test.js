// src/utils/__tests__/leagueCap.test.js
// League › Cap's shaping of GET /contracts/summary (leagueCap.js): sort,
// bar scale, Arizona folded into Utah, totals, and the unavailable case.

import { describe, it, expect } from 'vitest'
import { buildLeagueCapTable, fmtCapTotal } from '../leagueCap'

const team = (code, capHitTotal, over = {}) => ({
  team: code, contracts: 30, withFigure: 28, capHitTotal, expiring: { ufa: 4, rfa: 3, unknown: 0 }, ...over,
})

const summary = {
  season: '2026-27', basis: 'signing_team', asOf: '2026-10-24T12:08:21+00:00',
  capLimits: { ceiling: 104_000_000, floor: 77_000_000, minSalary: 850_000 },
  teams: [
    team('BUF', 125_416_405, { contracts: 29, withFigure: 29, expiring: { ufa: 5, rfa: 9, unknown: 0 } }),
    team('UTA', 83_348_334, { contracts: 23, withFigure: 21, expiring: { ufa: 6, rfa: 2, unknown: 0 } }),
    team('CAR', 90_000_000),
    team('ARI', 7_150_000, { contracts: 2, withFigure: 1, expiring: { ufa: 1, rfa: 0, unknown: 0 } }),
  ],
  unavailable: false,
}

describe('buildLeagueCapTable', () => {
  it('sorts by cap hit total, ranks, and names NHL teams from teamConfig', () => {
    const t = buildLeagueCapTable(summary)
    // UTA sorts above CAR once Arizona's 7.15M folds in (90.5M vs 90.0M)
    expect(t.rows.map(r => r.team)).toEqual(['BUF', 'UTA', 'CAR'])
    expect(t.rows.map(r => r.rank)).toEqual([1, 2, 3])
    expect(t.rows[0].name).toBe('Buffalo Sabres')
    expect(t.rows[0].known).toBe(true)
    expect(t.season).toBe('2026-27')
    expect(t.ceiling).toBe(104_000_000)
    expect(t.unavailable).toBe(false)
  })

  it('folds still-running Arizona deals into Utah and flags the row', () => {
    const t = buildLeagueCapTable(summary)
    const uta = t.rows.find(r => r.team === 'UTA')
    expect(t.rows.some(r => r.team === 'ARI')).toBe(false)
    expect(uta.capHitTotal).toBe(83_348_334 + 7_150_000)
    expect(uta.contracts).toBe(25)
    expect(uta.withFigure).toBe(22)
    expect(uta.expiring).toEqual({ ufa: 7, rfa: 2, unknown: 0 })
    expect(uta.includesArizona).toBe(true)
    expect(t.rows.find(r => r.team === 'BUF').includesArizona).toBe(false)
  })

  it('scales the bar to the largest total, not the ceiling, and keeps the ceiling share', () => {
    const t = buildLeagueCapTable(summary)
    expect(t.maxTotal).toBe(125_416_405)
    expect(t.rows[0].pctOfMax).toBe(100)
    expect(t.rows[2].pctOfMax).toBe(72)
    expect(t.rows[0].pctOfCeiling).toBe(121)
    expect(t.rows[2].pctOfCeiling).toBe(87)
  })

  it('sums league totals', () => {
    const t = buildLeagueCapTable(summary)
    expect(t.totals.contracts).toBe(29 + 30 + 23 + 2)
    expect(t.totals.withFigure).toBe(29 + 28 + 21 + 1)
    expect(t.totals.expiring).toEqual({ ufa: 5 + 4 + 6 + 1, rfa: 9 + 3 + 2, unknown: 0 })
  })

  it('keeps an unknown code as its own row, named by the code', () => {
    const t = buildLeagueCapTable({ ...summary, teams: [team('XYZ', 1)] })
    expect(t.rows[0]).toMatchObject({ team: 'XYZ', name: 'XYZ', known: false })
  })

  it('falls back to the live ceiling when the Worker has no cap limits', () => {
    const t = buildLeagueCapTable({ ...summary, capLimits: null }, 100_000_000)
    expect(t.ceiling).toBe(100_000_000)
    expect(t.rows[0].pctOfCeiling).toBe(125)
    expect(buildLeagueCapTable({ ...summary, capLimits: null }).rows[0].pctOfCeiling).toBeNull()
  })

  it('is unavailable with no teams, or when the route says so', () => {
    expect(buildLeagueCapTable({ ...summary, teams: [] }).unavailable).toBe(true)
    expect(buildLeagueCapTable({ ...summary, unavailable: true }).unavailable).toBe(true)
    expect(buildLeagueCapTable(null).unavailable).toBe(true)
    expect(buildLeagueCapTable(null).rows).toEqual([])
    expect(buildLeagueCapTable(null).maxTotal).toBe(0)
  })
})

describe('fmtCapTotal', () => {
  it('formats to one decimal in millions', () => {
    expect(fmtCapTotal(125_416_405)).toBe('$125.4M')
    expect(fmtCapTotal(0)).toBe('$0.0M')
    expect(fmtCapTotal(null)).toBeNull()
  })
})
