// src/utils/__tests__/playoffOddsFormat.test.js
// The PWHL/AHL/ECHL playoff-odds card (contract C10) from
// /{league}/playoff-odds. The routes had no run to read when this was
// written (the pipeline's first nightly hadn't run), so the answers below
// are hand-made in the route's documented shape (eyewall-poller
// leagueOddsRankings.js; eyewall-pipeline hockeytech_playoff_odds.py's
// odds_rows()).

import { describe, it, expect } from 'vitest'
import { formatOddsPct, leagueOddsView, PLAYOFF_ODDS_EARLY_GP } from '../playoffOddsFormat'

const row = over => ({
  season_id: 11, team_id: 1, run_date: '2026-12-10', make_playoffs_pct: 0.6412, win_division_pct: null,
  proj_points_p10: 38, proj_points_p50: 45, proj_points_p90: 52, current_points: 9, games_remaining: 26,
  sims: 10000, format: '8 of 12: top 4 in each conference (points %)', ...over,
})

describe('formatOddsPct', () => {
  it('rounds fractions, never a flat 0% or 100% for a sometimes', () => {
    expect([0.6412, 0.003, 0.997, 0, 1, null].map(formatOddsPct)).toEqual(['64%', '<1%', '>99%', '0%', '100%', '—'])
  })
})

describe('leagueOddsView', () => {
  it('hides the card without a run, or when the route can’t be read', () => {
    expect(leagueOddsView({ latest: null, history: [] })).toBeNull()
    expect(leagueOddsView({ latest: null, history: [], unavailable: true })).toBeNull()
    expect(leagueOddsView(null)).toBeNull()
  })

  it('shows the playoff chance, and the division only where there is one', () => {
    const pwhl = leagueOddsView({ latest: row(), history: [], stale: false })
    expect(pwhl).toMatchObject({ formatKnown: true, showDivision: false, stale: false, early: false })
    expect(leagueOddsView({ latest: row({ win_division_pct: 0.21 }), history: [] }).showDivision).toBe(true)
  })

  it('shows projected points only for an unverified format, trending the projection', () => {
    const v = leagueOddsView({
      latest: row({ make_playoffs_pct: null, win_division_pct: null, format: 'unverified' }),
      history: [{ run_date: '2026-12-09', make_playoffs_pct: null, proj_points_p50: 43 }, { run_date: '2026-12-10', make_playoffs_pct: null, proj_points_p50: 45 }],
    })
    expect(v).toMatchObject({ formatKnown: false, showDivision: false, trend: [{ value: 43 }, { value: 45 }] })
  })

  it('trends the playoff chance in percent, from two runs on', () => {
    const one = leagueOddsView({ latest: row(), history: [{ run_date: '2026-12-10', make_playoffs_pct: 0.64 }] })
    expect(one.trend).toEqual([])
    const two = leagueOddsView({ latest: row(), history: [{ run_date: '2026-12-09', make_playoffs_pct: 0.5 }, { run_date: '2026-12-10', make_playoffs_pct: 0.64 }] })
    expect(two.trend).toEqual([{ value: 50 }, { value: 64 }])
  })

  it('notes a stale run first, else an early season by the NHL’s 20 games', () => {
    expect(PLAYOFF_ODDS_EARLY_GP).toBe(20)
    expect(leagueOddsView({ latest: row(), stale: true }, 4)).toMatchObject({ stale: true, early: false })
    expect(leagueOddsView({ latest: row() }, 4).early).toBe(true)
    expect(leagueOddsView({ latest: row() }, 20).early).toBe(false)
    expect(leagueOddsView({ latest: row() }, null).early).toBe(false)
  })
})
