// src/components/__tests__/pwhlPlayerPopupDefaults.test.jsx
// PWHLPlayerPopup's season label defaults to the season's own label. It
// was the literal '2025–26' whatever the season, so a player opened for
// 2026-27 (or any other season) carried last season's label.

import { describe, it, expect, vi } from 'vitest'

vi.mock('../../utils/seasonClient', () => ({
  fetchSeasonsConfig: vi.fn(() => Promise.reject(new Error('offline in tests'))),
  fetchComparisonSeasons: vi.fn(() => Promise.reject(new Error('offline in tests'))),
}))

import PWHLPlayerPopup from '../PWHLPlayerPopup.jsx'
import { PWHL_CURRENT_SEASON, getPWHLSeasonLabel } from '../../utils/pwhlConfig.js'

const props = el => el.props

describe('PWHLPlayerPopup defaults', () => {
  it('defaults to the current season and its label', () => {
    const p = props(PWHLPlayerPopup({ player: { player_id: 1 } }))
    expect(p.season).toBe(PWHL_CURRENT_SEASON)
    expect(p.seasonLabel).toBe(getPWHLSeasonLabel(PWHL_CURRENT_SEASON))
  })

  it('labels a passed season with that season', () => {
    const p = props(PWHLPlayerPopup({ player: { player_id: 1 }, season: 5 }))
    expect(p.seasonLabel).toBe(getPWHLSeasonLabel(5))
    expect(p.seasonLabel).not.toBe(getPWHLSeasonLabel(PWHL_CURRENT_SEASON))
  })

  it('keeps a label the caller passes', () => {
    expect(props(PWHLPlayerPopup({ season: 5, seasonLabel: 'X' })).seasonLabel).toBe('X')
  })
})
