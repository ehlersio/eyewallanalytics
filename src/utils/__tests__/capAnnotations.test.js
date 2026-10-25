// src/utils/__tests__/capAnnotations.test.js
// The cap-hit annotations' index and facts (capAnnotations.js): rows by
// playerId, one-way / two-way from `oneWay`, ELC, reported, and nothing
// claimed for a player the dataset doesn't know.

import { describe, it, expect } from 'vitest'
import { contractIndex, capFacts } from '../capAnnotations'

const payload = {
  season: '2026-27',
  players: [
    { playerId: 8478427, contractKey: 'k1', name: 'Sebastian Aho', team: 'CAR', currentTeam: 'CAR', capHit: 9_750_000, oneWay: true, contractType: 'extension', expiresAfter: '2031-32', yearsLeft: 5, tier: 'C' },
    { playerId: 8484203, contractKey: 'k2', name: 'Bradly Nadeau', team: 'CAR', currentTeam: null, capHit: 918_333, oneWay: false, contractType: 'ELC', expiresAfter: '2026-27', yearsLeft: 0, tier: 'E' },
    { playerId: 8476958, contractKey: 'k3', name: 'Jaccob Slavin', team: 'CAR', currentTeam: 'CAR', capHit: 6_396_063, oneWay: null, contractType: 'standard', expiresAfter: '2031-32', yearsLeft: 5, tier: 'B' },
    { playerId: 8482093, contractKey: 'k4', name: 'Seth Jarvis', team: 'CAR', currentTeam: 'CAR', capHit: null, oneWay: null, contractType: 'standard', expiresAfter: '2031-32', yearsLeft: 5, tier: 'B' },
    { playerId: 8482100, contractKey: null, name: 'Alexander Nikishin', team: null, currentTeam: 'CAR', capHit: null, oneWay: null, contractType: null, expiresAfter: null, yearsLeft: null, tier: null },
    { playerId: null, contractKey: 'k5' },
  ],
}

describe('contractIndex', () => {
  it('indexes rows with a contract by playerId and skips the rest', () => {
    const idx = contractIndex(payload)
    expect([...idx.keys()]).toEqual([8478427, 8484203, 8476958, 8482093])
    expect(contractIndex(null).size).toBe(0)
    expect(contractIndex({ players: 'nope' }).size).toBe(0)
  })
})

describe('capFacts', () => {
  const idx = contractIndex(payload)
  it('reads cap hit, one-way, expiry and team', () => {
    expect(capFacts(idx, 8478427)).toEqual({ capHit: 9_750_000, twoWay: false, isELC: false, expiresAfter: '2031-32', yearsLeft: 5, reported: false, team: 'CAR' })
    expect(capFacts(idx, '8478427').capHit).toBe(9_750_000)
  })
  it('flags a two-way ELC and a reported figure, with the signing team when off every roster', () => {
    expect(capFacts(idx, 8484203)).toMatchObject({ capHit: 918_333, twoWay: true, isELC: true, reported: true, team: 'CAR', expiresAfter: '2026-27' })
  })
  it('leaves one-way unknown when the dataset has no flag', () => {
    expect(capFacts(idx, 8476958).twoWay).toBeNull()
  })
  it('claims nothing for an unknown player, a row without figure or flag, or an unsigned roster player', () => {
    expect(capFacts(idx, 1)).toBeNull()
    expect(capFacts(idx, 8482093)).toBeNull()
    expect(capFacts(idx, 8482100)).toBeNull()
    expect(capFacts(null, 8478427)).toBeNull()
    expect(capFacts(idx, null)).toBeNull()
  })
})
