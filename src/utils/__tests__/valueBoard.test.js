// src/utils/__tests__/valueBoard.test.js
// League › Cap's contract-value leaderboard (valueBoard.js): who is rated,
// the skater and goalie scores from the popup's helpers, the joins by
// playerId, the order, and the popup player shape.

import { describe, it, expect } from 'vitest'
import { buildValueBoard, popupPlayer, VALUE_BOARD_MIN_GP, VALUE_BOARD_MIN_GP_GOALIES } from '../valueBoard'

const contract = (playerId, capHit, over = {}) => ({
  playerId, name: `Player ${playerId}`, team: 'CAR', currentTeam: 'CAR', position: 'C', onRoster: true,
  capHit, contractType: 'standard', tier: 'B', official: true, expiresAfter: '2028-29', yearsLeft: 2, ...over,
})
const skater = (playerId, gamesPlayed, points, over = {}) => ({
  playerId, skaterFullName: `First Last${playerId}`, lastName: `Last${playerId}`, teamAbbrevs: 'CAR', positionCode: 'C', gamesPlayed, points, ...over,
})

const contracts = {
  season: '2026-27', asOf: '2026-10-24T12:08:21+00:00',
  players: [
    contract(1, 8_200_000),                                   // 82 pts pace on $8.2M -> 10 pts/$M, no WAR yet
    contract(2, 4_100_000),                                   // blended with WAR
    contract(3, 1_000_000),                                   // under the $1.2M floor: not rated
    contract(4, 900_000, { contractType: 'ELC' }),            // ELC: not rated
    contract(5, null),                                        // no public figure
    contract(6, 5_000_000),                                   // under min GP
    contract(7, 3_000_000, { currentTeam: 'TOR', team: 'CAR', tier: 'E', official: false }), // traded, reported
    contract(8, 6_000_000, { currentTeam: null, onRoster: false }), // no skater stats at all (not playing)
    contract(10, 5_000_000, { position: 'G' }),               // goalie
    contract(11, 3_000_000, { position: 'G' }),               // goalie under min GP
    contract(12, 900_000, { position: 'G', contractType: 'ELC' }),
  ],
}
const skaters = [
  skater(1, 10, 10), skater(2, 10, 5), skater(3, 10, 8), skater(4, 10, 9), skater(5, 10, 9), skater(6, 9, 9),
  skater(7, 10, 9, { teamAbbrevs: 'CAR,TOR' }),
]
const analytics = { 2: { war: 0.5, gp: 20 }, 1: { war: 0.3, gp: 10 } } // 1 is under WAR_TIER_MIN_GP: points only
const goalies = { 10: { gsax: 10, gp: 5 }, 11: { gsax: 5, gp: 4 }, 12: { gsax: 4, gp: 10 } }

describe('buildValueBoard', () => {
  it('rates skaters with a figure, enough games and no ELC, from the popup\'s score', () => {
    const b = buildValueBoard({ contracts, skaters, analytics, goalies })
    expect(b.available).toBe(true)
    expect(b.season).toBe('2026-27')
    expect(b.minGp).toBe(VALUE_BOARD_MIN_GP)
    expect(b.minGpGoalies).toBe(VALUE_BOARD_MIN_GP_GOALIES)
    const ids = b.skaters.map(r => r.playerId)
    expect(ids).toEqual(expect.arrayContaining([1, 2, 7]))
    expect(ids).not.toEqual(expect.arrayContaining([3]))  // floor
    expect(ids).not.toEqual(expect.arrayContaining([4]))  // ELC
    expect(ids).not.toEqual(expect.arrayContaining([5]))  // no figure
    expect(ids).not.toEqual(expect.arrayContaining([6]))  // 9 GP
    expect(ids).not.toEqual(expect.arrayContaining([8]))  // no stats
    const one = b.skaters.find(r => r.playerId === 1)
    // 7 (9 pts in 10 GP on $3M = 24.6 pts/$M) ranks first; 1 is 10 pts/$M
    expect(one).toMatchObject({ gp: 10, points: 10, score: 10, method: 'points', rank: 2 })
    expect(one.label.label).toMatch(/Exceptional/)
  })

  it('blends WAR per 82 at 20+ GP, like the popup', () => {
    const b = buildValueBoard({ contracts, skaters, analytics, goalies })
    const two = b.skaters.find(r => r.playerId === 2)
    // 41 pts/82 pace on $4.1M = 10 pts/$M; WAR 0.5 over 20 GP -> 2.05 per 82 -> /4.1M*18 = 9 ; 0.6*10 + 0.4*9 = 9.6
    expect(two.method).toBe('blended')
    expect(two.score).toBe(9.6)
    expect(two.war).toBe(0.5)
  })

  it('takes the current team from the contracts route, name and GP from the NHL summary, and marks reported figures', () => {
    const b = buildValueBoard({ contracts, skaters, analytics, goalies })
    const seven = b.skaters.find(r => r.playerId === 7)
    expect(seven).toMatchObject({ team: 'TOR', name: 'First Last7', lastName: 'Last7', position: 'C', reported: true })
  })

  it('rates goalies by GSAX per $M with the same gates', () => {
    const b = buildValueBoard({ contracts, skaters, analytics, goalies })
    expect(b.goalies.map(r => r.playerId)).toEqual([10])
    expect(b.goalies[0]).toMatchObject({ gp: 5, gsax: 10, score: 2, rank: 1 })
    expect(b.goalies[0].label.label).toMatch(/Great/)
  })

  it('orders by score, ranks, and counts who was not rated', () => {
    const b = buildValueBoard({ contracts, skaters, analytics, goalies })
    const scores = b.skaters.map(r => r.score)
    expect(scores).toEqual([...scores].sort((x, y) => y - x))
    expect(b.skaters.map(r => r.rank)).toEqual([1, 2, 3])
    expect(b.counts).toEqual({ skaters: 8, skatersRated: 3, goalies: 3, goaliesRated: 1, noFigure: 1, elc: 2, underMinGp: 3 })
  })

  it('respects a custom minimum and is unavailable with nothing to rate', () => {
    const b = buildValueBoard({ contracts, skaters, analytics, goalies, minGp: 20, minGpGoalies: 20 })
    expect(b.skaters).toEqual([])
    expect(b.goalies).toEqual([])
    expect(b.available).toBe(false)
    expect(buildValueBoard({}).available).toBe(false)
    expect(buildValueBoard({ contracts: { players: [] }, skaters: [] }).counts.skaters).toBe(0)
  })

  it('popupPlayer splits the name the way PlayerPopup wants it', () => {
    expect(popupPlayer({ playerId: 1, name: 'Connor McDavid', lastName: 'McDavid', team: 'EDM', position: 'C' }))
      .toEqual({ id: 1, firstName: { default: 'Connor' }, lastName: { default: 'McDavid' }, teamAbbrev: 'EDM', positionCode: 'C' })
    expect(popupPlayer({ playerId: 2, name: 'Jean-Gabriel Pageau', lastName: null, team: 'NYI', position: 'C' }).lastName.default).toBe('Pageau')
    expect(popupPlayer({ playerId: 3, name: 'Oliver Ekman-Larsson', lastName: 'Ekman-Larsson' }).firstName.default).toBe('Oliver')
  })
})
