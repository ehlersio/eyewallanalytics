// src/utils/__tests__/hockeyTechRanks.test.js
// The PWHL/AHL/ECHL player popup's league rank badges (Phase 3 B3), from
// the real /ahl/league-players?season=90 (2025-26) answer, saved
// 2026-10-07 and cut to the fields ranked (fixtures/ahl-league-players-90.json).

import { describe, it, expect } from 'vitest'
import { playerLeagueRanks } from '../hockeyTechRanks.js'
import ahl90 from './fixtures/ahl-league-players-90.json'

describe('skaters: league rank by points', () => {
  it('ranks the points leader first', () => {
    expect(playerLeagueRanks(ahl90, 8744, false)).toEqual({ points: 1 }) // Pelletier, 77
  })

  it('gives tied players the same rank', () => {
    // Hughes and Kaliyev, 68 points each, behind 77 and 70.
    expect(playerLeagueRanks(ahl90, 7016, false)).toEqual({ points: 3 })
    expect(playerLeagueRanks(ahl90, '7677', false)).toEqual({ points: 3 })
  })

  it('has no rank for a player without a row (the badge hides)', () => {
    expect(playerLeagueRanks(ahl90, 999999, false)).toBeNull()
    expect(playerLeagueRanks(null, 8744, false)).toBeNull()
  })
})

describe('goalies: SV% and GAA among the goalies the Leaders cards rank', () => {
  it('ranks by SV% (higher first) and GAA (lower first)', () => {
    expect(playerLeagueRanks(ahl90, 10038, true)).toEqual({ svPct: 1, gaa: 1 }) // Gylander .942, 1.62
    expect(playerLeagueRanks(ahl90, 10748, true)).toEqual({ svPct: 2, gaa: 2 }) // Postava .937, 1.71
  })

  it('leaves out a goalie under the GP gate, as the Leaders cards do', () => {
    // Lalonde: 1 GP, 1.000 -- would otherwise rank first.
    expect(playerLeagueRanks(ahl90, 9653, true)).toBeNull()
    expect(playerLeagueRanks(ahl90, 10038, true).svPct).toBe(1)
  })

  it('shows only the rank it can compute when GAA is missing', () => {
    const r = playerLeagueRanks(ahl90, 4961, true) // Brossoit: SV% .901, GAA null
    expect(r.gaa).toBeNull()
    expect(r.svPct).toBeGreaterThan(1)
  })
})
