// src/utils/__tests__/capTable.test.js
// The Cap tab's shaping of a GET /contracts payload (capTable.js) and the
// contract-value helpers after their move out of carContracts.js
// (contractValue.js), plus the live cap limits.

import { describe, it, expect } from 'vitest'
import {
  buildCapTable, capHitPct, fmtCapHit, provenanceCounts, rosterNameMap, displayName, isReported,
} from '../capTable'
import {
  applyCapConfig, capLimits, CAP_CEILING, CAP_FLOOR, MIN_SALARY,
  contractValue, goalieContractValue, pointsPer60, valueLabel, goalieValueLabel, WAR_SCALE,
} from '../contractValue'

const row = (over = {}) => ({
  contractKey: '1|CAR|2024-07', playerId: 1, name: 'A Player', team: 'CAR', position: 'C', onRoster: true,
  capHit: 5_000_000, aav: 5_000_000, yearsLeft: 2, expiresAfter: '2028-29', expiryType: 'UFA',
  expiryTypeDerived: false, contractType: 'STANDARD', tier: 'B', official: true, clauses: [],
  ...over,
})

// The shape the Worker's buildTeamContracts returns (2026-10-24 CAR figures).
const payload = {
  team: 'CAR', season: '2026-27', asOf: '2026-10-24T06:12:00Z', rosterKnown: true,
  rows: [
    row({ playerId: 8478427, name: 'Sebastian Aho', capHit: 9_750_000 }),
    row({ playerId: 8480830, contractKey: '2', name: 'Hurricanes.Andrei Svechnikov', capHit: 7_750_000, tier: 'E', official: false }),
    row({ playerId: 8476921, contractKey: '3', name: 'Jordan Martinook', capHit: 3_125_000, yearsLeft: 0, expiryType: 'UFA', expiryTypeDerived: true }),
    row({ playerId: 8482100, contractKey: '4', name: 'Alexander Nikishin', capHit: null, yearsLeft: 0, expiryType: 'RFA', contractType: 'ELC', tier: 'D', official: false }),
    row({ playerId: 8470000, contractKey: '5', name: 'Mike Reilly', onRoster: false, position: null, capHit: 850_000, yearsLeft: 0, expiryType: null }),
  ],
  missing: [{ playerId: 8482093, name: 'Seth Jarvis', position: 'RW', gap: 'no_money', status: 'signed' }],
  summary: {
    rosterCapHit: 20_625_000, rosterCount: 5, rosterWithFigure: 3, rosterWithoutFigure: 2, offRosterCount: 1,
    capLimits: { ceiling: 104_000_000, floor: 77_000_000, minSalary: 850_000 },
    expiring: { ufa: 1, rfa: 1, unknown: 0 },
  },
  unavailable: false,
}

describe('buildCapTable', () => {
  it('splits roster, missing and off-roster rows and keeps the Worker order', () => {
    const cap = buildCapTable(payload)
    expect(cap.rosterRows.map(r => r.playerId)).toEqual([8478427, 8480830, 8476921, 8482100])
    expect(cap.offRosterRows.map(r => r.name)).toEqual(['Mike Reilly'])
    expect(cap.missing).toHaveLength(1)
    expect(cap.season).toBe('2026-27')
    expect(cap.asOf).toBe('2026-10-24T06:12:00Z')
  })

  it('reads the roster cap hit and the ceiling from the summary, as a percent', () => {
    const cap = buildCapTable(payload)
    expect(cap.rosterCapHit).toBe(20_625_000)
    expect(cap.ceiling).toBe(104_000_000)
    expect(cap.capPct).toBe(20)
    expect(cap.rosterCount).toBe(5)
    expect(cap.rosterWithFigure).toBe(3)
  })

  it('falls back to the live ceiling and sums roster cap hits when the summary is missing', () => {
    const cap = buildCapTable({ ...payload, summary: null }, null, 100_000_000)
    expect(cap.ceiling).toBe(100_000_000)
    expect(cap.rosterCapHit).toBe(9_750_000 + 7_750_000 + 3_125_000)
    expect(cap.capPct).toBe(21)
    expect(cap.rosterCount).toBe(5) // 4 roster rows + 1 missing
    expect(cap.rosterWithFigure).toBe(3)
    expect(cap.expiringTotal).toBe(0)
  })

  it('counts official (tiers A-C) against reported (D/E) across every row', () => {
    const cap = buildCapTable(payload)
    expect(cap.provenance).toEqual({ official: 3, reported: 2 })
    expect(provenanceCounts([])).toEqual({ official: 0, reported: 0 })
  })

  it('marks reported tiers, derived expiry and expiring rows', () => {
    const cap = buildCapTable(payload)
    const byId = Object.fromEntries(cap.rosterRows.map(r => [r.playerId, r]))
    expect(byId[8480830].reported).toBe(true)
    expect(byId[8478427].reported).toBe(false)
    expect(byId[8476921].expiring).toBe(true)
    expect(byId[8476921].expiryTypeDerived).toBe(true)
    expect(byId[8478427].expiring).toBe(false)
    expect(cap.hasDerived).toBe(true)
    expect(cap.hasReported).toBe(true)
    expect(isReported({ tier: 'C' })).toBe(false)
    expect(isReported({ tier: 'E' })).toBe(true)
  })

  it('takes the expiring counts from the summary, including the unknown bucket', () => {
    const cap = buildCapTable({ ...payload, summary: { ...payload.summary, expiring: { ufa: 8, rfa: 1, unknown: 2 } } })
    expect(cap.expiring).toEqual({ ufa: 8, rfa: 1, unknown: 2 })
    expect(cap.expiringTotal).toBe(11)
  })

  it('prefers the roster name for roster rows (dataset names can carry a prefix)', () => {
    const roster = { all: [
      { id: 8480830, firstName: { default: 'Andrei' }, lastName: { default: 'Svechnikov' } },
      { id: 8470000, firstName: { default: 'Not' }, lastName: { default: 'OnRoster' } },
    ] }
    const names = rosterNameMap(roster)
    expect(names.get(8480830)).toBe('Andrei Svechnikov')
    const cap = buildCapTable(payload, names)
    expect(cap.rosterRows[1].displayName).toBe('Andrei Svechnikov')
    expect(cap.rosterRows[0].displayName).toBe('Sebastian Aho')
    // off-roster rows keep the dataset's name even when the roster knows the id
    expect(cap.offRosterRows[0].displayName).toBe('Mike Reilly')
    expect(displayName({ onRoster: true, playerId: 1, name: 'Fallback' }, new Map())).toBe('Fallback')
  })

  it('reads the raw NHL roster groups too', () => {
    const names = rosterNameMap({ forwards: [{ id: '1', firstName: { default: 'A' }, lastName: { default: 'B' } }], defensemen: [], goalies: [{ id: 2, firstName: { default: 'C' }, lastName: { default: 'D' } }] })
    expect([...names.entries()]).toEqual([[1, 'A B'], [2, 'C D']])
    expect(rosterNameMap(null).size).toBe(0)
  })

  it('handles an unavailable or empty payload without throwing', () => {
    const cap = buildCapTable({ unavailable: true, rows: [], missing: [], summary: null })
    expect(cap.rosterRows).toEqual([])
    expect(cap.rosterCapHit).toBe(0)
    expect(cap.capPct).toBe(0)
    expect(buildCapTable(null).rosterRows).toEqual([])
  })
})

describe('dead cap and the estimate', () => {
  const withDead = {
    ...payload,
    deadCapKnown: true,
    deadCap: [
      { team: 'CAR', kind: 'retained', playerName: 'Traded Out', playerId: 8470000, counterparty: 'TOR', season: '2026-27', capHit: 1_500_000, pct: 50, tier: 'D', flags: [] },
      { team: 'CAR', kind: 'buyout', playerName: 'Bought Out', playerId: null, counterparty: null, season: '2026-27', capHit: 1_100_000, pct: null, tier: 'E', flags: [] },
    ],
    summary: { ...payload.summary, deadCap: { total: 2_600_000, retained: 1_500_000, buyouts: 1_100_000, count: 2 }, capSpaceEstimate: 104_000_000 - 20_625_000 - 2_600_000, estimateNotes: ['no_ltir', 'no_bonus_overages', 'no_recapture', 'partial_coverage'] },
  }

  it('passes the Worker estimate, its notes and the rows through when the table was known', () => {
    const cap = buildCapTable(withDead)
    expect(cap.deadCapKnown).toBe(true)
    expect(cap.deadCap).toEqual({ total: 2_600_000, retained: 1_500_000, buyouts: 1_100_000, count: 2 })
    expect(cap.deadCapRows.map(r => r.kind)).toEqual(['retained', 'buyout'])
    expect(cap.estimate).toBe(80_775_000)
    expect(cap.estimateNotes).toContain('no_ltir')
  })

  it('shows nothing when the Worker could not read the table, or before it existed', () => {
    const unknown = buildCapTable({ ...withDead, deadCapKnown: false, deadCap: [], summary: { ...withDead.summary, deadCap: null, capSpaceEstimate: null, estimateNotes: null } })
    expect(unknown).toMatchObject({ deadCapKnown: false, deadCap: null, deadCapRows: [], estimate: null, estimateNotes: [] })
    const old = buildCapTable(payload) // a payload from before eyewall-poller #237
    expect(old).toMatchObject({ deadCapKnown: false, estimate: null })
  })

  it('keeps a negative estimate (over the ceiling before LTIR relief)', () => {
    const cap = buildCapTable({ ...withDead, summary: { ...withDead.summary, capSpaceEstimate: -1_200_000 } })
    expect(cap.estimate).toBe(-1_200_000)
  })
})

describe('formatting helpers', () => {
  it('fmtCapHit', () => {
    expect(fmtCapHit(9_750_000)).toBe('$9.75M')
    expect(fmtCapHit(850_000)).toBe('$0.85M')
    expect(fmtCapHit(null)).toBeNull()
    expect(fmtCapHit('x')).toBeNull()
  })
  it('capHitPct', () => {
    expect(capHitPct(88_164_730, 104_000_000)).toBe(85)
    expect(capHitPct(null, 104_000_000)).toBeNull()
    expect(capHitPct(1, 0)).toBeNull()
  })
})

describe('cap limits (contractValue.js)', () => {
  it('seeds 2026-27 and applies a /config/cap payload for the current season only', () => {
    expect(capLimits()).toEqual({ season: '2026-27', ceiling: 104_000_000, floor: 77_000_000, minSalary: 850_000 })
    expect(CAP_CEILING).toBe(104_000_000)
    expect(CAP_FLOOR).toBe(77_000_000)
    expect(MIN_SALARY).toBe(850_000)
    // same values: no change
    expect(applyCapConfig({ current: '2026-27', seasons: { '2026-27': { ceiling: 104_000_000, floor: 77_000_000, minSalary: 850_000 } } })).toBe(false)
    // incomplete or missing: keep the seed
    expect(applyCapConfig(null)).toBe(false)
    expect(applyCapConfig({ current: '2027-28', seasons: {} })).toBe(false)
    expect(applyCapConfig({ current: '2027-28', seasons: { '2027-28': { ceiling: 113_500_000 } } })).toBe(false)
    expect(capLimits().season).toBe('2026-27')
    // a full entry for a new current season replaces it
    expect(applyCapConfig({ current: '2027-28', seasons: { '2027-28': { ceiling: 113_500_000, floor: 84_000_000, minSalary: 850_000 } } })).toBe(true)
    expect(capLimits()).toEqual({ season: '2027-28', ceiling: 113_500_000, floor: 84_000_000, minSalary: 850_000 })
    // restore for the other tests in this file
    applyCapConfig({ current: '2026-27', seasons: { '2026-27': { ceiling: 104_000_000, floor: 77_000_000, minSalary: 850_000 } } })
  })
})

describe('contract value helpers (moved from carContracts.js)', () => {
  it('contractValue blends points and WAR, or uses points only', () => {
    expect(WAR_SCALE).toBe(18)
    expect(contractValue(82, 82, 8_200_000, false)).toEqual({ score: 10, method: 'points' })
    expect(contractValue(41, 82, 4_100_000, false, 1.0)).toEqual({ score: 7.8, method: 'blended' })
    expect(contractValue(41, 82, 4_100_000, true)).toBeNull()      // ELC excluded
    expect(contractValue(41, 82, 1_000_000, false)).toBeNull()     // under the $1.2M floor
    expect(contractValue(41, 0, 4_100_000, false)).toBeNull()
    expect(contractValue(41, 82, null, false)).toBeNull()
  })

  it('goalieContractValue is GSAX per $M', () => {
    expect(goalieContractValue(10, 30, 5_000_000, false)).toBe(2)
    expect(goalieContractValue(-6, 30, 3_000_000, false)).toBe(-2)
    expect(goalieContractValue(10, 30, 5_000_000, true)).toBeNull()
    expect(goalieContractValue(null, 30, 5_000_000, false)).toBeNull()
  })

  it('pointsPer60', () => {
    expect(pointsPer60(30, 82 * 18 * 60)).toBe(1.2)
    expect(pointsPer60(0, 1000)).toBeNull()
  })

  it('labels follow the documented scales', () => {
    expect(valueLabel(8).label).toMatch(/Exceptional/)
    expect(valueLabel(5).label).toMatch(/Great/)
    expect(valueLabel(3).label).toMatch(/Good/)
    expect(valueLabel(1.8).label).toMatch(/Fair/)
    expect(valueLabel(1).label).toMatch(/Below/)
    expect(valueLabel(0.9).label).toMatch(/Overpaid/)
    expect(valueLabel(null)).toBeNull()
    expect(goalieValueLabel(4).label).toMatch(/Exceptional/)
    expect(goalieValueLabel(0).label).toMatch(/Fair/)
    expect(goalieValueLabel(-2.1).label).toMatch(/Overpaid/)
  })
})
