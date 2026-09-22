// src/utils/__tests__/rankBadge.test.js
// The Team pages' rank badges: ordinal suffixes in both languages, and colour
// tiers that scale with the league's size. Each page used to hand-roll
// r === 1 ? 'st' : ... -- English only, and wrong past 20 ("21th") -- and the
// AHL/ECHL copies used the PWHL's 8-team cut-offs, painting 7th of 32 red.

import { describe, it, expect } from 'vitest'
import { ordinalSuffix } from '../formatters'
import { rankTier } from '../../components/RankBadge.jsx'

describe('ordinalSuffix', () => {
  it.each([
    [1, 'st'], [2, 'nd'], [3, 'rd'], [4, 'th'],
    [11, 'th'], [12, 'th'], [13, 'th'],
    [21, 'st'], [22, 'nd'], [23, 'rd'], [31, 'st'], [32, 'nd'],
  ])('English %i -> %s', (n, suffix) => {
    expect(ordinalSuffix(n, 'en')).toBe(suffix)
  })

  it.each([[1, 'er'], [2, 'e'], [3, 'e'], [21, 'e'], [32, 'e']])('French %i -> %s', (n, suffix) => {
    expect(ordinalSuffix(n, 'fr')).toBe(suffix)
  })

  it('reads a regional tag by its language', () => {
    expect(ordinalSuffix(1, 'fr-CA')).toBe('er')
  })

  it('falls back to English for an unknown language', () => {
    expect(ordinalSuffix(22, 'de')).toBe('nd')
  })
})

describe('rankTier', () => {
  const tiers = (of) => Array.from({ length: of }, (_, i) => rankTier(i + 1, of))
  const counts = (of) => tiers(of).reduce((c, t) => ({ ...c, [t]: (c[t] ?? 0) + 1 }), {})

  it('keeps the NHL at top 5 / top 15 of 32', () => {
    expect(rankTier(5, 32)).toBe('good')
    expect(rankTier(6, 32)).toBe('mid')
    expect(rankTier(15, 32)).toBe('mid')
    expect(rankTier(16, 32)).toBe('bad')
  })

  it('keeps a 12-team PWHL at the 2 / 6 it always had', () => {
    expect(counts(12)).toEqual({ good: 2, mid: 4, bad: 6 })
  })

  it('no longer paints mid-table AHL teams red', () => {
    expect(rankTier(7, 32)).toBe('mid')
  })

  it('always leaves the leader green, even in a tiny field', () => {
    expect(rankTier(1, 3)).toBe('good')
    expect(rankTier(1, 6)).toBe('good')
  })
})
