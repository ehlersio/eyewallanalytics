// src/utils/__tests__/pwhlSalaries.test.js
// Salaries tab season fallback. /pwhl/salaries on 2026-10-06: BOS (1) has
// 2025-26 rows only, LV (12, 2026-27 expansion) has none in any season.

import { describe, it, expect, vi } from 'vitest'
import { salarySeasonLabels, fetchLatestSalaries } from '../pwhlSalaries'

const BOS_2025_26 = [
  { player_id: 12, team_id: 1, salary: 105000, season: '2025-26' },
  { player_id: 15, team_id: 1, salary: 95000, season: '2025-26' },
]
const live = { 1: { '2025-26': BOS_2025_26 } }
const fetchSalaries = vi.fn(async (teamId, season) => live[teamId]?.[season] ?? [])

describe('salarySeasonLabels', () => {
  it('keeps order, drops duplicates and anything that is not a YYYY-YY label', () => {
    expect(salarySeasonLabels(['2026-27', '2025-26', '2025-26', '2024-25', 'Season 11', null, '2023-24']))
      .toEqual(['2026-27', '2025-26', '2024-25', '2023-24'])
  })
})

describe('fetchLatestSalaries', () => {
  const labels = ['2026-27', '2025-26', '2024-25', '2023-24']

  it('after the flip, falls back to the newest season with rows', async () => {
    expect(await fetchLatestSalaries(1, labels, fetchSalaries)).toEqual({ season: '2025-26', rows: BOS_2025_26 })
  })

  it('stops at the current season when it has rows', async () => {
    fetchSalaries.mockClear()
    expect(await fetchLatestSalaries(1, labels.slice(1), fetchSalaries)).toEqual({ season: '2025-26', rows: BOS_2025_26 })
    expect(fetchSalaries).toHaveBeenCalledTimes(1)
  })

  it('has no rows for an expansion team (the tab is hidden)', async () => {
    expect(await fetchLatestSalaries(12, labels, fetchSalaries)).toEqual({ season: null, rows: [] })
  })

  it('reports unknown (null rows) when a request fails, without trying older seasons', async () => {
    const failing = vi.fn(async () => null)
    expect(await fetchLatestSalaries(1, labels, failing)).toEqual({ season: '2026-27', rows: null })
    expect(failing).toHaveBeenCalledTimes(1)
  })
})
