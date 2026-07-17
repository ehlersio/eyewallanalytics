// src/utils/__tests__/seasonComparison.test.js
// Tests for the season-over-season comparison label/normalization helpers
// (Session 64). These are pure functions with no React/fetch dependency —
// same convention as statFormatting.test.js.

import { describe, it, expect } from 'vitest'
import { nhlSeasonLabel, pwhlSeasonLabel, normalizeComparisonSeasons } from '../seasonComparison.js'

describe('nhlSeasonLabel', () => {
  it('formats the season number as "YYYY-YY"', () => {
    expect(nhlSeasonLabel(20252026)).toBe('2025-26')
    expect(nhlSeasonLabel(20262027)).toBe('2026-27')
  })

  it('accepts a string season too', () => {
    expect(nhlSeasonLabel('20232024')).toBe('2023-24')
  })
})

describe('pwhlSeasonLabel', () => {
  it('formats a regular season', () => {
    expect(pwhlSeasonLabel({ seasonId: 8, seasonType: 'regular', startYear: 2025 })).toBe('2025-26')
  })

  it('formats a playoffs season', () => {
    expect(pwhlSeasonLabel({ seasonId: 9, seasonType: 'playoffs', startYear: 2025 })).toBe('2025-26 Playoffs')
  })

  it('formats a preseason season', () => {
    expect(pwhlSeasonLabel({ seasonId: 2, seasonType: 'preseason', startYear: 2023 })).toBe('2023-24 Preseason')
  })

  it('falls back to "Season N" when the bootstrap has no metadata for it (real gap: PWHL season_id 3)', () => {
    expect(pwhlSeasonLabel({ seasonId: 3, seasonType: null, startYear: null })).toBe('Season 3')
  })
})

describe('normalizeComparisonSeasons', () => {
  it('normalizes NHL seasons, tagging every row as regular (the endpoint already filters to game_type=2)', () => {
    const result = normalizeComparisonSeasons('nhl', [
      { season: 20262027, teamCount: 32, comparable: true },
      { season: 20232024, teamCount: 16, comparable: false },
    ])
    expect(result).toEqual([
      { value: 20262027, label: '2026-27', comparable: true, teamCount: 32, seasonType: 'regular' },
      { value: 20232024, label: '2023-24', comparable: false, teamCount: 16, seasonType: 'regular' },
    ])
  })

  it('normalizes PWHL seasons using seasonId as the value', () => {
    const result = normalizeComparisonSeasons('pwhl', [
      { seasonId: 9, seasonType: 'playoffs', startYear: 2025, teamCount: 4, comparable: false },
      { seasonId: 8, seasonType: 'regular',  startYear: 2025, teamCount: 8, comparable: true },
    ])
    expect(result).toEqual([
      { value: 9, label: '2025-26 Playoffs', comparable: false, teamCount: 4, seasonType: 'playoffs' },
      { value: 8, label: '2025-26',          comparable: true,  teamCount: 8, seasonType: 'regular' },
    ])
  })

  it('defaults to an empty array when seasons is omitted', () => {
    expect(normalizeComparisonSeasons('nhl')).toEqual([])
    expect(normalizeComparisonSeasons('pwhl')).toEqual([])
  })
})
