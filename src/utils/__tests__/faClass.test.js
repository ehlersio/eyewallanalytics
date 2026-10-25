// src/utils/__tests__/faClass.test.js
// The team's free-agent class from a GET /contracts payload (faClass.js):
// which deals count, the UFA/RFA/unknown split, roster-first order, ages
// from the roster, markers, and next summer's roster counts.

import { describe, it, expect } from 'vitest'
import { buildFaClass, summerYear, ageOn } from '../faClass'
import { rosterIndex } from '../capTable'

const row = (over = {}) => ({
  playerId: 1, name: 'A Player', position: 'C', onRoster: true, capHit: 3_000_000, yearsLeft: 0,
  expiryType: 'UFA', expiryTypeDerived: false, contractType: 'standard', tier: 'B', official: true,
  ...over,
})

const data = {
  season: '2026-27',
  rows: [
    row({ playerId: 8473533, name: 'Jordan Staal', capHit: 2_900_000, tier: 'E', official: false }),
    row({ playerId: 8476921, name: 'Jordan Martinook', position: 'L', capHit: 3_050_000, expiryTypeDerived: true }),
    row({ playerId: 8480291, name: "Skyler Brind'Amour", capHit: null, expiryTypeDerived: true }),
    row({ playerId: 8484392, name: 'Felix Unger Sörum', position: 'R', capHit: 831_667, expiryType: 'RFA', contractType: 'ELC', tier: 'E', official: false }),
    row({ playerId: 8484203, name: 'Bradly Nadeau', position: null, onRoster: false, capHit: 918_333, expiryType: 'RFA', contractType: 'ELC' }),
    row({ playerId: 8482888, name: 'Bryce Montgomery', position: null, onRoster: false, capHit: null, expiryType: 'RFA', expiryTypeDerived: true }),
    row({ playerId: 9, name: 'No Status', capHit: 1_000_000, expiryType: null }),
    // not in this summer's class
    row({ playerId: 8475791, name: 'Taylor Hall', capHit: 3_166_667, yearsLeft: 1 }),
    row({ playerId: 8476873, name: 'Mark Jankowski', capHit: 1_850_000, yearsLeft: 1, expiryType: 'RFA' }),
    row({ playerId: 10, name: 'Off Roster Next', onRoster: false, capHit: 850_000, yearsLeft: 1 }),
    row({ playerId: 8478427, name: 'Sebastian Aho', capHit: 9_750_000, yearsLeft: 5 }),
  ],
}

const roster = rosterIndex({ all: [
  { id: 8473533, firstName: { default: 'Jordan' }, lastName: { default: 'Staal' }, birthDate: '1988-09-10', positionCode: 'C' },
  { id: 8476921, firstName: { default: 'Jordan' }, lastName: { default: 'Martinook' }, birthDate: '1992-07-25', positionCode: 'L' },
] })
const NOW = new Date('2026-10-24T12:00:00')

describe('buildFaClass', () => {
  it('takes only deals ending after this season and splits them by expiry type', () => {
    const fa = buildFaClass(data, roster, NOW)
    expect(fa.total).toBe(7)
    expect(fa.ufa.map(r => r.name)).toEqual(['Jordan Martinook', 'Jordan Staal', "Skyler Brind'Amour"])
    expect(fa.rfa.map(r => r.name)).toEqual(['Felix Unger Sörum', 'Bradly Nadeau', 'Bryce Montgomery'])
    expect(fa.unknown.map(r => r.name)).toEqual(['No Status'])
    expect(fa.rosterTotal).toBe(5)
    expect(fa.offRosterTotal).toBe(2)
  })

  it('orders roster players first, then by cap hit, figures before "no public figure"', () => {
    const fa = buildFaClass(data, roster, NOW)
    expect(fa.ufa.map(r => [r.onRoster, r.capHit])).toEqual([[true, 3_050_000], [true, 2_900_000], [true, null]])
    expect(fa.rfa.map(r => [r.onRoster, r.capHit])).toEqual([[true, 831_667], [false, 918_333], [false, null]])
  })

  it('labels the summer and next summer from the season', () => {
    const fa = buildFaClass(data, roster, NOW)
    expect(fa.season).toBe('2026-27')
    expect(fa.summer).toBe(2027)
    // roster deals ending a season later: Hall (UFA), Jankowski (RFA); the off-roster one is not counted
    expect(fa.nextSummer).toEqual({ ufa: 1, rfa: 1, unknown: 0 })
  })

  it('reads ages and positions from the roster for roster players only', () => {
    const fa = buildFaClass(data, roster, NOW)
    const staal = fa.ufa.find(r => r.playerId === 8473533)
    expect(staal.age).toBe(38)
    expect(staal.position).toBe('C')
    expect(fa.ufa.find(r => r.playerId === 8476921).age).toBe(34)
    expect(fa.ufa.find(r => r.playerId === 8480291).age).toBeNull()
    expect(fa.rfa.find(r => r.playerId === 8484203).age).toBeNull()
  })

  it('carries the derived-expiry and reported markers', () => {
    const fa = buildFaClass(data, roster, NOW)
    expect(fa.ufa.find(r => r.playerId === 8476921).expiryTypeDerived).toBe(true)
    expect(fa.ufa.find(r => r.playerId === 8473533).reported).toBe(true)
    expect(fa.ufa.find(r => r.playerId === 8476921).reported).toBe(false)
    expect(fa.hasDerived).toBe(true)
    expect(fa.hasReported).toBe(true)
  })

  it('is empty, not broken, without rows or with nothing expiring', () => {
    expect(buildFaClass(null).total).toBe(0)
    const fa = buildFaClass({ season: '2026-27', rows: [row({ yearsLeft: 3 })] })
    expect(fa.total).toBe(0)
    expect(fa.ufa).toEqual([])
    expect(fa.nextSummer).toEqual({ ufa: 0, rfa: 0, unknown: 0 })
  })
})

describe('summerYear / ageOn', () => {
  it('summerYear reads the second half of a YYYY-YY season, across a century', () => {
    expect(summerYear('2026-27')).toBe(2027)
    expect(summerYear('2099-00')).toBe(2100)
    expect(summerYear('20262027')).toBeNull()
    expect(summerYear(null)).toBeNull()
  })
  it('ageOn counts whole years as of the given day', () => {
    expect(ageOn('1988-09-10', new Date('2026-10-24T12:00:00'))).toBe(38)
    expect(ageOn('1988-09-10', new Date('2026-09-09T12:00:00'))).toBe(37)
    expect(ageOn('1988-09-10', new Date('2026-09-10T12:00:00'))).toBe(38)
    expect(ageOn('2027-01-01', new Date('2026-10-24T12:00:00'))).toBeNull()
    expect(ageOn(null)).toBeNull()
    expect(ageOn('not a date')).toBeNull()
  })
})
