// src/utils/__tests__/nhlSummaries.test.js
// Period and game summaries (usePeriodSummary.js) built from real games'
// play-by-play (fixtures/nhl-games, see nhlGameMath.test.js), checked
// against the NHL's own final score and shot totals.
import { describe, it, expect } from 'vitest'
import { buildSummary, buildGameSummary, scoreAfterPeriod } from '../../hooks/usePeriodSummary.js'
import { withoutShootout } from '../gamePlays.js'

import g2026020018 from './fixtures/nhl-games/2026020018.json'
import g2025020121 from './fixtures/nhl-games/2025020121.json'
import g2026010026 from './fixtures/nhl-games/2026010026.json'
import g2025030132 from './fixtures/nhl-games/2025030132.json'
import g2026010044 from './fixtures/nhl-games/2026010044.json'

const CAR = 12
const game = g => buildGameSummary(g.pbp.plays, CAR, null, g.pbp, g.pbp.id)
const period = (g, n, isPlayoff = false) => buildSummary(n, g.pbp.plays, CAR, null, g.pbp, g.pbp.id, isPlayoff)

describe('game summary', () => {
  it("shows a shootout win's final score, not the tied score its SO goal carries (CAR 5-4 SO at COL)", () => {
    const s = game(g2025020121)
    expect(s.periodLabel).toBe('Final/SO')
    expect([s.awayScore, s.homeScore]).toEqual([5, 4])
    expect([s.carScore, s.oppScore]).toEqual([5, 4])
    // Shootout attempts are no shots or goals
    expect([s.carSOG, s.oppSOG]).toEqual([31, 48])
    expect([s.carGoals, s.oppGoals]).toEqual([4, 4])
    expect(s.goals.every(goal => goal.period <= 4)).toBe(true)
    expect(s.periodStats.map(ps => ps.label)).toEqual(['P1', 'P2', 'P3', 'OT'])
  })

  it("doesn't count FLA@CAR's two CAR shootout goals (2026-09-22, 3-2 SO)", () => {
    const s = game(g2026010026)
    expect([s.homeScore, s.awayScore]).toEqual([3, 2])
    expect([s.carGoals, s.oppGoals]).toEqual([2, 2])
    expect([s.carSOG, s.oppSOG]).toEqual([26, 33])
  })

  it('counts Corsi once per attempt (WSH@CAR 2026-10-02: 81-43, CF 65.3%)', () => {
    const s = game(g2026020018)
    expect([s.carCorsi, s.oppCorsi]).toEqual([81, 43])
    expect(s.corsiForPct).toBe(65.3)
    expect([s.carSOG, s.oppSOG]).toEqual([33, 27])
    expect([s.homeScore, s.awayScore]).toEqual([2, 5])
  })

  it("labels a playoff double OT '2OT' (CAR 3-2 OTT, 2026-04-20)", () => {
    const s = game(g2025030132)
    expect(s.periodLabel).toBe('Final/OT')
    expect(s.periodStats.map(ps => ps.label)).toEqual(['P1', 'P2', 'P3', 'OT', '2OT'])
    expect([s.homeScore, s.awayScore]).toEqual([3, 2])
  })

  it('has no shot numbers from a goals-only feed except the NHL totals (NSH@CAR 2026-09-24)', () => {
    const s = game(g2026010044)
    expect([s.carSOG, s.oppSOG]).toEqual([31, 28])
    expect(s.carCorsi).toBeNull()
    expect(s.corsiForPct).toBeNull()
    expect(s.fenwickForPct).toBeNull()
    expect(s.carHDCF).toBeNull()
    expect(s.carHits).toBeNull()
    expect(s.periodStats).toEqual([])
    expect(s.bestPeriod).toBeNull()
    expect([s.homeScore, s.awayScore, s.carGoals, s.oppGoals]).toEqual([6, 5, 6, 5])
  })
})

describe('period summary', () => {
  it('keeps the score through a scoreless period (FLA@CAR P3, 2-2)', () => {
    const s = period(g2026010026, 3)
    expect(s.goals).toEqual([])
    expect([s.homeScore, s.awayScore]).toEqual([2, 2])
    expect([s.carScore, s.oppScore]).toEqual([2, 2])
  })

  it('labels the overtime of a regular-season or preseason game OT', () => {
    expect(period(g2026010026, 4).periodShort).toBe('OT')
  })

  it("labels a playoff game's period 5 2OT, from the game's own type", () => {
    // isPlayoff false here, as when the team had no playoff games yet this season
    const s = period(g2025030132, 5, false)
    expect(s.periodShort).toBe('2OT')
    expect(s.periodLabel).toBe('2OT')
    expect(s.carGoals).toBe(1)
    expect([s.homeScore, s.awayScore]).toEqual([3, 2])
  })

  it('has nothing for the shootout (CAR@COL period 5)', () => {
    const s = period(g2025020121, 5)
    expect(s.goals).toEqual([])
    expect([s.carSOG, s.oppSOG]).toEqual([0, 0])
    // the score after it is still the OT score
    expect([s.awayScore, s.homeScore]).toEqual([4, 4])
  })

  it('shows no shot numbers for a goals-only feed', () => {
    const s = period(g2026010044, 1)
    expect(s.carSOG).toBeNull()
    expect(s.corsiForPct).toBeNull()
    expect(s.fenwickForPct).toBeNull()
  })
})

describe('scoreAfterPeriod', () => {
  it('is 0-0 before any goal', () => {
    expect(scoreAfterPeriod([], 1)).toEqual({ awayScore: 0, homeScore: 0 })
  })

  it('reads goals from earlier periods too (WSH@CAR)', () => {
    const plays = withoutShootout(g2026020018.pbp.plays)
    for (const n of [1, 2, 3]) {
      const goals = plays.filter(p => p.typeDescKey === 'goal' && p.periodDescriptor.number <= n)
      const last = goals.at(-1)
      expect(scoreAfterPeriod(plays, n)).toEqual({ awayScore: last?.details.awayScore ?? 0, homeScore: last?.details.homeScore ?? 0 })
    }
    expect(scoreAfterPeriod(plays, 3)).toEqual({ awayScore: 5, homeScore: 2 })
  })
})
