// src/utils/__tests__/eloWinProb.test.js
// The Elo win probability the game preview and schedule chips show -- must
// match the Worker's eloWinProb() and the pipeline's win_probs.py exactly.

import { describe, it, expect } from 'vitest'
import { homeWinProb, teamWinPct } from '../eloWinProb'

const ELO = { ratings: { CAR: 1560, FLA: 1540 }, homeAdvantage: 35 }
const game = (home, away, extra = {}) => ({ homeTeam: { abbrev: home }, awayTeam: { abbrev: away }, ...extra })

describe('homeWinProb', () => {
  it('is the Elo expected score with home advantage added to the home side', () => {
    expect(homeWinProb(1560, 1540, 35)).toBeCloseTo(1 / (1 + Math.pow(10, (1540 - 1595) / 400)), 12)
    expect(homeWinProb(1500, 1500, 0)).toBe(0.5)
  })

  it('drops the home advantage at a neutral site', () => {
    expect(homeWinProb(1560, 1540, 35, true)).toBeCloseTo(homeWinProb(1560, 1540, 0), 12)
    expect(homeWinProb(1560, 1540, 35, true)).toBeLessThan(homeWinProb(1560, 1540, 35))
  })
})

describe('teamWinPct', () => {
  it("returns each side's win %, summing to 100", () => {
    const g = game('CAR', 'FLA')
    const car = teamWinPct(ELO, g, 'CAR')
    const fla = teamWinPct(ELO, g, 'FLA')
    expect(car).toBe(Math.round(homeWinProb(1560, 1540, 35) * 100))
    expect(car + fla).toBe(100)
  })

  it('uses the neutral-site flag from the schedule', () => {
    expect(teamWinPct(ELO, game('CAR', 'FLA', { neutralSite: true }), 'CAR'))
      .toBe(Math.round(homeWinProb(1560, 1540, 0) * 100))
  })

  it('uses 1500 for a team with no rating', () => {
    expect(teamWinPct(ELO, game('UTA', 'CAR'), 'UTA')).toBe(Math.round(homeWinProb(1500, 1560, 35) * 100))
  })

  it('is null when ratings are unavailable or the team is not in the game', () => {
    expect(teamWinPct(null, game('CAR', 'FLA'), 'CAR')).toBeNull()
    expect(teamWinPct({ ratings: {}, homeAdvantage: 35 }, game('CAR', 'FLA'), 'CAR')).toBeNull()
    expect(teamWinPct({ ...ELO, unavailable: true }, game('CAR', 'FLA'), 'CAR')).toBeNull()
    expect(teamWinPct(ELO, game('CAR', 'FLA'), 'BOS')).toBeNull()
    expect(teamWinPct(ELO, {}, 'CAR')).toBeNull()
  })
})
