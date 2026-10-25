// src/utils/__tests__/contractHistory.test.js
// Which season rows the popup shows under a contract (contractHistory.js):
// the exact contract key first, a same-team overlapping row as a flagged
// fallback, and never a name-matched stranger's deal.

import { describe, it, expect } from 'vitest'
import { contractSeasons, boughtOutNote } from '../contractHistory'

const season = (s, capHit, over = {}) => ({
  season: s, capHit, aav: capHit, baseSalary: capHit, signingBonus: 0, performanceBonus: 0,
  totalSalary: capHit, minorsSalary: capHit, oneWay: true, clause: null, tier: 'E', ...over,
})
const entry = (contractKey, team, tier, startSeason, expiresAfter, seasons) => ({ contractKey, team, tier, startSeason, expiresAfter, seasons })

// Carolina's Aho: the exact row has 8 seasons; a name-matched Islanders
// Aho row (PIT, two-way) sits first in history.
const aho = {
  season: '2026-27',
  current: { contractKey: 'sebastian aho|CAR|2023-07', team: 'CAR', tier: 'C', startSeason: '2024-25', expiresAfter: '2031-32' },
  history: [
    entry('sebastian aho|PIT|2024-07', 'PIT', 'C', '2024-25', '2025-26', [season('2024-25', 775_000), season('2025-26', 775_000)]),
    entry('sebastian aho|CAR|2023-07', 'CAR', 'C', '2024-25', '2031-32', [
      season('2024-25', 9_750_000, { baseSalary: 10_000_000, signingBonus: 2_000_000, clause: 'NMC' }),
      season('2025-26', 9_750_000, { baseSalary: 10_000_000, signingBonus: 2_000_000, clause: 'NMC' }),
      season('2026-27', 9_750_000, { baseSalary: 7_000_000, signingBonus: 2_000_000, clause: 'NMC' }),
    ]),
    entry('sebastian aho|CAR|2019-07', 'CAR', 'E', '2019-20', '2023-24', [season('2019-20', 8_454_000)]),
  ],
}

// Slavin: the current id-keyed B row has no seasons; the name-keyed E row
// for the same signing (slightly different span) has them.
const slavin = {
  season: '2026-27',
  current: { contractKey: '8476958|CAR|2024-07', team: 'CAR', tier: 'B', startSeason: '2024-25', expiresAfter: '2031-32' },
  history: [
    entry('jaccob slavin|CAR|2024-07', 'CAR', 'E', '2025-26', '2029-30', [
      season('2025-26', 6_396_063, { baseSalary: 1_000_000, signingBonus: 7_000_000, clause: 'NMC', oneWay: null, minorsSalary: null }),
      season('2026-27', 6_396_063, { baseSalary: 1_000_000, signingBonus: 5_000_000, clause: 'NMC', oneWay: null, minorsSalary: null }),
    ]),
    entry('8476958|CAR|2024-07', 'CAR', 'B', '2024-25', '2031-32', []),
    entry('jaccob slavin|CAR|2017-07', 'CAR', 'C', '2018-19', '2024-25', [season('2018-19', 5_300_000), season('2024-25', 5_300_000)]),
  ],
}

describe('contractSeasons', () => {
  it('takes the rows of the exact contract key, not the newest history row', () => {
    const r = contractSeasons(aho)
    expect(r.source).toBe('contract')
    expect(r.contractKey).toBe('sebastian aho|CAR|2023-07')
    expect(r.seasons.map(s => s.season)).toEqual(['2024-25', '2025-26', '2026-27'])
    expect(r.seasons[2]).toMatchObject({ capHit: 9_750_000, baseSalary: 7_000_000, signingBonus: 2_000_000, clause: 'NMC', twoWay: false, reported: true, tier: 'E' })
  })

  it('falls back to a same-team overlapping row when the exact row has no seasons, and says so', () => {
    const r = contractSeasons(slavin)
    expect(r.source).toBe('alternate')
    expect(r.contractKey).toBe('jaccob slavin|CAR|2024-07')
    expect(r.tier).toBe('E')
    expect(r.seasons.map(s => s.season)).toEqual(['2025-26', '2026-27'])
    expect(r.seasons[1].signingBonus).toBe(5_000_000)
    expect(r.seasons[1].twoWay).toBe(false) // oneWay null is not "two-way"
  })

  it('a row of the same signing (key suffix |TEAM|YYYY-MM) beats a better-tier row that merely has the season', () => {
    const payload = {
      ...slavin,
      history: [
        ...slavin.history,
        entry('jaccob slavin|CAR|2024-06', 'CAR', 'C', '2024-25', '2031-32', [season('2026-27', 6_460_000)]),
      ],
    }
    expect(contractSeasons(payload).contractKey).toBe('jaccob slavin|CAR|2024-07')
  })

  it('without a same-signing row, takes the best-tier same-team row that has the shown season', () => {
    const payload = {
      season: '2026-27',
      current: { contractKey: '1|CAR|2024-07', team: 'CAR', tier: 'B', startSeason: '2024-25', expiresAfter: '2031-32' },
      history: [
        entry('1|CAR|2024-07', 'CAR', 'B', '2024-25', '2031-32', []),
        entry('one name|CAR|2024-09', 'CAR', 'E', '2024-25', '2031-32', [season('2026-27', 5)]),
        entry('one name|CAR|2024-08', 'CAR', 'D', '2024-25', '2031-32', [season('2026-27', 6)]),
      ],
    }
    expect(contractSeasons(payload).contractKey).toBe('one name|CAR|2024-08')
  })

  it('never borrows another team\'s row, a previous contract, or a row without the shown season', () => {
    const payload = {
      season: '2026-27',
      current: { contractKey: 'x|CAR|2026-07', team: 'CAR', tier: 'B', startSeason: '2026-27', expiresAfter: '2028-29' },
      history: [
        entry('x|CAR|2026-07', 'CAR', 'B', '2026-27', '2028-29', []),
        entry('x name|NYI|2026-07', 'NYI', 'E', '2026-27', '2028-29', [season('2026-27', 1)]),
        entry('x name|CAR|2020-07', 'CAR', 'C', '2020-21', '2026-27', [season('2020-21', 1), season('2025-26', 1)]),
      ],
    }
    expect(contractSeasons(payload)).toEqual({ seasons: [], source: null, contractKey: null, tier: null })
  })

  it('marks two-way seasons and handles missing payloads', () => {
    const payload = {
      current: { contractKey: 'k', team: 'CAR', startSeason: '2026-27', expiresAfter: '2027-28' },
      history: [entry('k', 'CAR', 'B', '2026-27', '2027-28', [season('2026-27', 850_000, { oneWay: false, minorsSalary: 90_000, tier: 'B' })])],
    }
    const r = contractSeasons(payload)
    expect(r.seasons[0]).toMatchObject({ twoWay: true, minorsSalary: 90_000, reported: false })
    expect(contractSeasons(null).seasons).toEqual([])
    expect(contractSeasons({ current: null, history: [] }).source).toBeNull()
    expect(contractSeasons({ unavailable: true }).seasons).toEqual([])
  })
})

describe('boughtOutNote', () => {
  // Aho's CAR deal bought out after 2024-25: the dataset ends it there and
  // keeps the signed end, so nothing is `current` in 2026-27.
  const bought = (over = {}) => ({
    ...entry('sebastian aho|CAR|2023-07', 'CAR', 'C', '2024-25', '2024-25', []),
    boughtOut: true, endSeasonSigned: '2031-32', ...over,
  })
  const payload = (history, over = {}) => ({ season: '2026-27', current: null, history, ...over })

  it('finds the bought-out deal that would have covered this season', () => {
    const history = [
      entry('sebastian aho|PIT|2024-07', 'PIT', 'C', '2024-25', '2025-26', []),
      bought(),
      entry('sebastian aho|CAR|2019-07', 'CAR', 'E', '2019-20', '2023-24', []),
    ]
    expect(boughtOutNote(payload(history))).toEqual({ team: 'CAR', endSeason: '2024-25', endSeasonSigned: '2031-32', reported: false })
  })

  it('returns null when the bought-out deal would not have covered this season', () => {
    expect(boughtOutNote(payload([bought({ endSeasonSigned: '2025-26' })]))).toBeNull()
    expect(boughtOutNote(payload([bought({ startSeason: '2027-28', expiresAfter: '2027-28' })]))).toBeNull()
    // not bought out: an ordinary expired deal says nothing
    expect(boughtOutNote(payload([bought({ boughtOut: false })]))).toBeNull()
  })

  it('returns null without history, without a payload, or with a current contract', () => {
    expect(boughtOutNote(payload([]))).toBeNull()
    expect(boughtOutNote(payload(undefined))).toBeNull()
    expect(boughtOutNote(null)).toBeNull()
    expect(boughtOutNote(payload([bought()], { current: { contractKey: 'x|NYR|2026-07', team: 'NYR' } }))).toBeNull()
  })

  it('flags a reported (tier D/E) row and prefers the better tier for the same deal', () => {
    expect(boughtOutNote(payload([bought({ tier: 'E' })])).reported).toBe(true)
    expect(boughtOutNote(payload([bought({ tier: 'D' })])).reported).toBe(true)
    const both = [bought({ contractKey: 'sebastian aho|CAR|2023-07', tier: 'E' }), bought({ contractKey: '8478427|CAR|2023-07', tier: 'B' })]
    expect(boughtOutNote(payload(both)).reported).toBe(false)
  })
})
