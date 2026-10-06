// src/utils/__tests__/hockeyTechLeaders.test.js
import { describe, it, expect } from 'vitest'
import { goalieLeaderMinGp, qualifiedGoalies } from '../hockeyTechLeaders.js'

const g = (gp, player_name = `G${gp}`) => ({ player_name, gp })

describe('goalieLeaderMinGp', () => {
  it('is 1 on opening weekend, when nobody has played twice', () => {
    expect(goalieLeaderMinGp([g(1), g(0), g(2)])).toBe(1)
    expect(goalieLeaderMinGp([g(3)])).toBe(1)
  })

  it('is half the busiest goalie\'s games as the season goes on', () => {
    expect(goalieLeaderMinGp([g(4), g(1)])).toBe(2)
    expect(goalieLeaderMinGp([g(7)])).toBe(3)
    expect(goalieLeaderMinGp([g(9)])).toBe(4)
  })

  it('settles at 5 once the leaders have 10 games, and stays there', () => {
    expect(goalieLeaderMinGp([g(10)])).toBe(5)
    expect(goalieLeaderMinGp([g(40), g(12)])).toBe(5)
  })

  it('is 1 with no goalies or no games, never 0', () => {
    expect(goalieLeaderMinGp([])).toBe(1)
    expect(goalieLeaderMinGp([g(0), { player_name: 'Unknown' }])).toBe(1)
  })
})

describe('qualifiedGoalies', () => {
  it('keeps named goalies at or above the scaled gate', () => {
    const goalies = [g(2, 'A'), g(1, 'B'), g(0, 'C'), { gp: 2 }]
    expect(qualifiedGoalies(goalies).map(x => x.player_name)).toEqual(['A', 'B'])
  })

  it('applies the full 5-game bar in a mature season', () => {
    const goalies = [g(20, 'A'), g(5, 'B'), g(4, 'C')]
    expect(qualifiedGoalies(goalies).map(x => x.player_name)).toEqual(['A', 'B'])
  })
})
