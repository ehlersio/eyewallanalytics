// src/utils/__tests__/nhlSeasonTotal.test.js
// The player popup's per-season NHL totals (audit 2026-10-05 #28), from
// real /player/{id}/landing seasonTotals (2026-10-05). Taking the first
// row for a season showed Brandon Bussi's AHL 2024-25 as an NHL season and
// only the PHI part (24 GP, 1 pt) of Nicolas Deslauriers' 2025-26, which
// he finished with CAR (31 GP, 2 pts).

import { describe, it, expect } from 'vitest'
import { nhlSeasonTotal, latestNhlSeasonTotal, nhlSeasonsPlayed } from '../nhlPlayerStats.js'
import deslauriers from './fixtures/nhl-audit-2026-10-05/landing-8475235-deslauriers.json'
import bussi from './fixtures/nhl-audit-2026-10-05/landing-8483548-bussi.json'

const toSec = v => v.split(':').reduce((m, s, i) => (i === 0 ? +s * 60 : m + +s), 0)

describe('nhlSeasonTotal', () => {
  it("adds up a traded player's NHL stints (Deslauriers 2025-26: PHI + CAR)", () => {
    const stints = deslauriers.seasonTotals.filter(s => s.season === 20252026 && s.gameTypeId === 2)
    expect(stints.map(s => s.teamCommonName.default)).toEqual(['Flyers', 'Hurricanes'])

    const total = nhlSeasonTotal(deslauriers.seasonTotals, 20252026, 2)
    expect(total).toMatchObject({
      combined: true, teams: ['Flyers', 'Hurricanes'], season: 20252026, gameTypeId: 2,
      gamesPlayed: 31, goals: 0, assists: 2, points: 2, pim: 38, plusMinus: -3, shots: 18,
    })
    expect(total.shootingPctg).toBe(0)
    // TOI/G weighted by games: (8:05 x 24 + 10:09 x 7) / 31
    expect(toSec(total.avgToi)).toBe(Math.round((toSec('8:05') * 24 + toSec('10:09') * 7) / 31))
    // No faceoff counts on the landing, so no made-up combined FO%.
    expect(total.faceoffWinningPctg).toBeUndefined()
  })

  it('returns a single-team season unchanged', () => {
    const row = deslauriers.seasonTotals.find(s => s.season === 20242025 && s.gameTypeId === 2)
    expect(nhlSeasonTotal(deslauriers.seasonTotals, 20242025, 2)).toBe(row)
    expect(nhlSeasonTotal(deslauriers.seasonTotals, '20242025', 2)).toBe(row)
  })

  it('never returns an AHL season as an NHL one (Bussi 2024-25)', () => {
    expect(bussi.seasonTotals.some(s => s.season === 20242025 && s.gameTypeId === 2 && s.leagueAbbrev === 'AHL')).toBe(true)
    expect(nhlSeasonTotal(bussi.seasonTotals, 20242025, 2)).toBeNull()
    expect(nhlSeasonTotal(bussi.seasonTotals, 20252026, 2)).toMatchObject({ leagueAbbrev: 'NHL', gamesPlayed: 39, wins: 31 })
  })

  it("combines a goalie's rates from the sums", () => {
    const nhl = bussi.seasonTotals.filter(s => s.leagueAbbrev === 'NHL' && s.gameTypeId === 2)
    // Two real stints, labelled as one season, to check the goalie math.
    const rows = nhl.map((s, i) => ({ ...s, season: 20252026, sequence: i + 1 }))
    const total = nhlSeasonTotal(rows, 20252026, 2)
    const ga = nhl[0].goalsAgainst + nhl[1].goalsAgainst
    const sa = nhl[0].shotsAgainst + nhl[1].shotsAgainst
    const seconds = toSec(nhl[0].timeOnIce) + toSec(nhl[1].timeOnIce)
    expect(total).toMatchObject({ gamesPlayed: 41, gamesStarted: 41, goalsAgainst: ga, shotsAgainst: sa, wins: 31, shutouts: 2 })
    expect(total.savePctg).toBeCloseTo((sa - ga) / sa, 6)
    expect(total.goalsAgainstAvg).toBeCloseTo((ga * 3600) / seconds, 6)
  })
})

describe('latestNhlSeasonTotal / nhlSeasonsPlayed', () => {
  it('falls back to the last NHL season, skipping AHL ones', () => {
    expect(latestNhlSeasonTotal(bussi.seasonTotals, 2, 20252026)).toBeNull()
    expect(latestNhlSeasonTotal(bussi.seasonTotals, 2, 20262027)).toMatchObject({ season: 20252026, leagueAbbrev: 'NHL' })
    expect(latestNhlSeasonTotal(deslauriers.seasonTotals, 2, 20262027)).toMatchObject({ season: 20252026, gamesPlayed: 31, combined: true })
  })

  it("lists only seasons with NHL games (Compare's season chips)", () => {
    expect([...nhlSeasonsPlayed(bussi.seasonTotals, 2)].sort()).toEqual([20252026, 20262027])
    expect(nhlSeasonsPlayed(deslauriers.seasonTotals, 2).has(20252026)).toBe(true)
  })
})
