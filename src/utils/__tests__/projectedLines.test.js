// src/utils/__tests__/projectedLines.test.js
// hasProjection()/projectionCopyKeys() -- when the Scouting tab's
// "Projected lines" block shows, and which copy it uses.

import { describe, it, expect } from 'vitest'
import { hasProjection, projectionCopyKeys } from '../projectedLines'

const unit = { rank: 1, players: [{ id: 1, name: 'A', pos: 'C', filled: false }] }

describe('hasProjection', () => {
  it('shows a projection with units', () => {
    expect(hasProjection({ basis: 'last_game', lines: [unit], pairs: [] })).toBe(true)
    expect(hasProjection({ basis: 'preseason', lines: [], pairs: [unit] })).toBe(true)
  })

  it('hides a missing, failed, or empty projection', () => {
    expect(hasProjection(null)).toBe(false)
    expect(hasProjection({ basis: null, lines: [], pairs: [] })).toBe(false)
    expect(hasProjection({ basis: 'last_game', lines: [unit], pairs: [], unavailable: true })).toBe(false)
    expect(hasProjection({ basis: 'last_game', lines: [], pairs: [] })).toBe(false)
  })
})

describe('projectionCopyKeys', () => {
  it('uses opening-night copy only for preseason projections', () => {
    expect(projectionCopyKeys('preseason')).toEqual({ basisKey: 'basisPreseason', accuracyKey: 'accuracyPreseason' })
    expect(projectionCopyKeys('last_game')).toEqual({ basisKey: 'basisLastGame', accuracyKey: 'accuracyInSeason' })
  })
})
