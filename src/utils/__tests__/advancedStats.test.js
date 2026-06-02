// src/utils/__tests__/advancedStats.test.js
// Unit tests for pure shot-analysis functions in advancedStats.js

import { describe, it, expect } from 'vitest'
import { computeShotAttempts, seasonPDO } from '../advancedStats.js'

const CAR_TEAM_ID = 12
const OPP_TEAM_ID = 99

// ── helpers ──────────────────────────────────────────────────
function play(typeDescKey, teamId) {
  return { typeDescKey, details: { eventOwnerTeamId: teamId } }
}

// ── computeShotAttempts ───────────────────────────────────────
describe('computeShotAttempts', () => {
  it('counts goals for both teams', () => {
    const plays = [
      play('goal', CAR_TEAM_ID),
      play('goal', CAR_TEAM_ID),
      play('goal', OPP_TEAM_ID),
    ]
    const result = computeShotAttempts(plays, CAR_TEAM_ID)
    expect(result.car.goals).toBe(2)
    expect(result.opp.goals).toBe(1)
  })

  it('counts shots on goal', () => {
    const plays = [
      play('shot-on-goal', CAR_TEAM_ID),
      play('shot-on-goal', CAR_TEAM_ID),
      play('shot-on-goal', OPP_TEAM_ID),
    ]
    const result = computeShotAttempts(plays, CAR_TEAM_ID)
    expect(result.car.sog).toBe(2)
    expect(result.opp.sog).toBe(1)
  })

  it('counts missed shots', () => {
    const plays = [
      play('missed-shot', CAR_TEAM_ID),
      play('missed-shot', OPP_TEAM_ID),
      play('missed-shot', OPP_TEAM_ID),
    ]
    const result = computeShotAttempts(plays, CAR_TEAM_ID)
    expect(result.car.missed).toBe(1)
    expect(result.opp.missed).toBe(2)
  })

  it('counts blocked shots', () => {
    const plays = [
      play('blocked-shot', CAR_TEAM_ID),
      play('blocked-shot', CAR_TEAM_ID),
      play('blocked-shot', CAR_TEAM_ID),
    ]
    const result = computeShotAttempts(plays, CAR_TEAM_ID)
    expect(result.car.blocked).toBe(3)
    expect(result.opp.blocked).toBe(0)
  })

  it('Corsi includes sog (goals count as sog) + missed + blocked', () => {
    // goal → goals++ AND sog++
    // So: 1 goal = goals:1 sog:1; 1 shot-on-goal = sog:1; 1 missed = missed:1; 1 blocked = blocked:1
    // carCorsi = goals(1) + sog(2) + missed(1) + blocked(1) = 5
    // opp: 1 goal = goals:1 sog:1 → oppCorsi = goals(1) + sog(1) = 2
    const plays = [
      play('goal', CAR_TEAM_ID),
      play('shot-on-goal', CAR_TEAM_ID),
      play('missed-shot', CAR_TEAM_ID),
      play('blocked-shot', CAR_TEAM_ID),
      play('goal', OPP_TEAM_ID),
    ]
    const result = computeShotAttempts(plays, CAR_TEAM_ID)
    expect(result.car.goals).toBe(1)
    expect(result.car.sog).toBe(2)    // goal + shot-on-goal both add to sog
    expect(result.carCorsi).toBe(5)   // goals(1) + sog(2) + missed(1) + blocked(1)
    expect(result.oppCorsi).toBe(2)   // opp goal: goals(1) + sog(1)
  })

  it('Fenwick excludes blocked shots (goals count as sog)', () => {
    // carFenwick = goals + sog + missed (no blocked) = 1+2+1 = 4
    // oppFenwick = goals + sog = 1+1 = 2
    const plays = [
      play('goal', CAR_TEAM_ID),
      play('shot-on-goal', CAR_TEAM_ID),
      play('missed-shot', CAR_TEAM_ID),
      play('blocked-shot', CAR_TEAM_ID), // NOT in Fenwick
      play('goal', OPP_TEAM_ID),
    ]
    const result = computeShotAttempts(plays, CAR_TEAM_ID)
    expect(result.carFenwick).toBe(4)   // goals(1) + sog(2) + missed(1)
    expect(result.oppFenwick).toBe(2)   // opp goals(1) + sog(1)
  })

  it('corsiForPct reflects actual goals+sog+missed+blocked ratio', () => {
    // 2 CAR shots-on-goal (no goals, no missed, no blocked) vs 2 OPP shots-on-goal
    // carCorsi = 0 + 2 + 0 + 0 = 2, oppCorsi = 0 + 2 + 0 + 0 = 2 → 50%
    const plays = [
      play('shot-on-goal', CAR_TEAM_ID),
      play('shot-on-goal', CAR_TEAM_ID),
      play('shot-on-goal', OPP_TEAM_ID),
      play('shot-on-goal', OPP_TEAM_ID),
    ]
    const result = computeShotAttempts(plays, CAR_TEAM_ID)
    expect(result.corsiForPct).toBe(50.0)
  })

  it('returns 50% corsiForPct for equal attempts', () => {
    const plays = [
      play('shot-on-goal', CAR_TEAM_ID),
      play('shot-on-goal', OPP_TEAM_ID),
    ]
    const result = computeShotAttempts(plays, CAR_TEAM_ID)
    expect(result.corsiForPct).toBe(50.0)
  })

  it('handles empty play array gracefully', () => {
    const result = computeShotAttempts([], CAR_TEAM_ID)
    expect(result.carCorsi).toBe(0)
    expect(result.oppCorsi).toBe(0)
    // Should not throw or return NaN
    expect(result.corsiForPct).toBeTypeOf('number')
    expect(isNaN(result.corsiForPct)).toBe(false)
  })

  it('ignores irrelevant play types', () => {
    const plays = [
      play('penalty', CAR_TEAM_ID),
      play('faceoff', OPP_TEAM_ID),
      play('stoppage', CAR_TEAM_ID),
    ]
    const result = computeShotAttempts(plays, CAR_TEAM_ID)
    expect(result.carCorsi).toBe(0)
    expect(result.oppCorsi).toBe(0)
  })
})

// ── seasonPDO ─────────────────────────────────────────────────
describe('seasonPDO', () => {
  it('returns null for missing corsi data', () => {
    expect(seasonPDO(null)).toBeNull()
    expect(seasonPDO(undefined)).toBeNull()
  })

  it('returns a PDO object with pdo, shPct, svPct, luck fields', () => {
    const corsi = {
      goalsForPerGame:      3.5,
      shotsForPerGame:      32.0,
      goalsAgainstPerGame:  2.5,
      shotsAgainstPerGame:  28.0,
    }
    const result = seasonPDO(corsi)
    expect(result).not.toBeNull()
    expect(result).toHaveProperty('pdo')
    expect(result).toHaveProperty('shPct')
    expect(result).toHaveProperty('svPct')
    expect(result).toHaveProperty('luck')
  })

  it('PDO near 100 for average team', () => {
    // 10% SH, 90% SV → PDO = (10 + 90) = 100
    const corsi = {
      goalsForPerGame:      3.0,   // 3/30 = 10% SH
      shotsForPerGame:      30.0,
      goalsAgainstPerGame:  3.0,   // 3/30 → SV = 90%
      shotsAgainstPerGame:  30.0,
    }
    const result = seasonPDO(corsi)
    expect(parseFloat(result.pdo)).toBeCloseTo(100.0, 0)
  })
})
