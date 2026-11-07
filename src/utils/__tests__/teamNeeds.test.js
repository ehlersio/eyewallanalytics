// utils/teamNeeds.js: the Needs tab's gate, rating format, rank tone,
// grouping and the needs summary order.

import { describe, it, expect } from 'vitest'
import { hasTeamNeeds, fmtRating, rankTone, groupSlots, needSlots, isGoalieSlot } from '../teamNeeds'

describe('hasTeamNeeds', () => {
  it('needs slots and no unavailable flag', () => {
    expect(hasTeamNeeds({ slots: [{ slot: 'D_TOP4' }] })).toBe(true)
    expect(hasTeamNeeds({ slots: [] })).toBe(false)
    expect(hasTeamNeeds({ slots: [{ slot: 'D_TOP4' }], unavailable: true })).toBe(false)
    expect(hasTeamNeeds(null)).toBe(false)
    expect(hasTeamNeeds({ basis: null })).toBe(false)
  })
})

describe('fmtRating', () => {
  it('signs and rounds to two decimals, keeps unrated null', () => {
    expect(fmtRating(0.4962)).toBe('+0.50')
    expect(fmtRating(-0.044)).toBe('−0.04')
    expect(fmtRating(0.001)).toBe('0.00')
    expect(fmtRating(-0.001)).toBe('0.00')
    expect(fmtRating(null)).toBeNull()
    expect(fmtRating(undefined)).toBeNull()
    expect(fmtRating('x')).toBeNull()
  })
})

describe('rankTone', () => {
  it('need, top third, middle, or unranked', () => {
    expect(rankTone({ leagueRank: 30, leagueTeams: 32, need: true })).toBe('need')
    expect(rankTone({ leagueRank: 11, leagueTeams: 32, need: false })).toBe('top')
    expect(rankTone({ leagueRank: 12, leagueTeams: 32, need: false })).toBe('mid')
    expect(rankTone({ leagueRank: null, leagueTeams: 16, need: false })).toBeNull()
    expect(rankTone(null)).toBeNull()
  })
})

describe('groupSlots / needSlots', () => {
  const slots = [
    { slot: 'G_1A', leagueRank: 7, leagueTeams: 32, need: false },
    { slot: 'D_TOP4', leagueRank: 32, leagueTeams: 32, need: true },
    { slot: 'F_TOP6_W', leagueRank: 22, leagueTeams: 29, need: true },
    { slot: 'G_1B', leagueRank: 26, leagueTeams: 26, need: true },
  ]

  it('groups in display order and drops empty groups', () => {
    const groups = groupSlots(slots)
    expect(groups.map(g => g.key)).toEqual(['forwards', 'defense', 'goalies'])
    expect(groups[2].slots.map(s => s.slot)).toEqual(['G_1A', 'G_1B'])
    expect(groupSlots([{ slot: 'G_1A' }]).map(g => g.key)).toEqual(['goalies'])
    expect(groupSlots(null)).toEqual([])
  })

  it('lists needs worst share of the league first', () => {
    expect(needSlots(slots).map(s => s.slot)).toEqual(['D_TOP4', 'G_1B', 'F_TOP6_W'])
    expect(needSlots([])).toEqual([])
  })

  it('knows goalie slots', () => {
    expect(isGoalieSlot('G_1B')).toBe(true)
    expect(isGoalieSlot('D_TOP4')).toBe(false)
    expect(isGoalieSlot(undefined)).toBe(false)
  })
})
