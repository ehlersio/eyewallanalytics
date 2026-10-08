// src/utils/__tests__/hockeyTechPowerRankings.test.js
// AHL/ECHL power rankings as the League tab shows them (contract C12).
// fixtures/ahl-power-rankings-94/route.json is /ahl/power-rankings's shape
// with real rows: eyewall-pipeline's own hockeytech_power_rankings.py
// compute_rankings() run on the Worker's AHL 2026-27 (94) standings and
// schedules of 2026-10-07 (no table to read yet, so no run had been
// written). prior_rank is null, as on a first run.

import { describe, it, expect } from 'vitest'
import route from './fixtures/ahl-power-rankings-94/route.json'
import {
  hockeyTechRankedRows, rankHistory, rankMovement, rankingWeightLabels, rankingsState,
} from '../hockeyTechPowerRankings'
import { AHL } from '../hockeyTechLeagues'

const abbrOf = id => AHL.config.getTeamById(id)?.abbr

describe('hockeyTechRankedRows', () => {
  const rows = hockeyTechRankedRows(route.latest, abbrOf)

  it('keeps the pipeline’s order and names every team', () => {
    expect(rows).toHaveLength(32)
    expect(rows.map(r => r.rank)).toEqual(Array.from({ length: 32 }, (_, i) => i + 1))
    expect(rows.every(r => /^[A-Z]{2,4}$/.test(r.abbr))).toBe(true)
  })

  it('reads the components as the table and share card take them', () => {
    const her = rows.find(r => r.abbr === 'HER')
    expect(her).toMatchObject({
      teamId: 319, rank: 23, priorRank: null, wins: 1, losses: 1, otLosses: 0,
      ptsPct: 0.5, l10: '1-1-0', l10PtsPct: 0.5, gdPG: -1, spPct: 0.375,
      leagueRanks: { pts: 24, l10: 24, gd: 22, sp: 30 },
    })
  })

  it('leaves a missing component empty rather than inventing it', () => {
    const [row] = hockeyTechRankedRows([{ team_id: 319, rank: 1, prior_rank: 3, score: 0.6, components: { record: '0-0-0' } }], abbrOf)
    expect(row).toMatchObject({ priorRank: 3, l10: null, l10PtsPct: null, spPct: null, leagueRanks: { pts: null, sp: null } })
    expect(hockeyTechRankedRows([{ team_id: 9999, rank: 1 }], abbrOf)[0].abbr).toBe('9999')
    expect(hockeyTechRankedRows([{ team_id: 319 }], abbrOf)).toEqual([])
  })
})

describe('movement, history, weights and the tab', () => {
  it('counts places moved since the run before', () => {
    expect(rankMovement(3, 5)).toBe(2)
    expect(rankMovement(5, 3)).toBe(-2)
    expect(rankMovement(4, 4)).toBe(0)
    expect(rankMovement(4, null)).toBeNull()
  })

  it('gives the sparkline its dated ranks', () => {
    expect(rankHistory([{ run_date: '2026-10-07', rank: 23 }, { run_date: null, rank: 1 }, { run_date: '2026-10-08', rank: 20 }]))
      .toEqual([{ date: '2026-10-07', rank: 23 }, { date: '2026-10-08', rank: 20 }])
    expect(rankHistory(undefined)).toEqual([])
  })

  it('shows the pipeline’s AHL/ECHL weights', () => {
    expect(rankingWeightLabels()).toEqual({ pts_pct: '41.2%', l10_pts_pct: '23.5%', gd_pg: '23.5%', special_teams: '11.8%' })
  })

  it('offers the tab only with rows, or a note when the Worker couldn’t read them', () => {
    expect(rankingsState(null, true)).toBe('loading')
    expect(rankingsState(route, false)).toBe('rows')
    expect(rankingsState({ latest: [], narrative: null, history: [] }, false)).toBe('empty')
    expect(rankingsState({ latest: [], narrative: null, history: [], unavailable: true }, false)).toBe('unavailable')
    expect(rankingsState(null, false)).toBe('empty')
  })
})
