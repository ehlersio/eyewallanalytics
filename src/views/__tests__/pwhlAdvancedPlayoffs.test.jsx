// src/views/__tests__/pwhlAdvancedPlayoffs.test.jsx
// PWHL Team > Advanced: the Regular/Playoffs toggle only with the team's
// playoff pwhl_team_seasons row (Phase 3 B7, no dead option). The row is
// the real MTL 2026 playoffs from /pwhl/team-seasons/compare (2026-10-07).

import { describe, it, expect, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'

vi.mock('../../utils/seasonClient', () => ({
  fetchSeasonsConfig: vi.fn(() => Promise.reject(new Error('offline in tests'))),
  fetchComparisonSeasons: vi.fn(() => Promise.reject(new Error('offline in tests'))),
}))

import '../../i18n/index.js'
import { AdvancedTab, playoffTeamRow } from '../PWHLTeamView.jsx'

const PO = { season: 9, gamesPlayed: 9, wins: 6, losses: 3, otLosses: 0, points: 18, goalsFor: 20, goalsAgainst: 15, ppPct: 0.158, pkPct: 0.929 }
const teamRow = { team_id: 3, gp: 30, goals_for: 78, goals_against: 41, pp_pct: 0.193, pk_pct: 0.918, points: 62 }

describe('playoffTeamRow', () => {
  it('is the playoff season\'s row with games', () => {
    expect(playoffTeamRow([PO], 9)).toBe(PO)
    expect(playoffTeamRow([{ ...PO, gamesPlayed: 0 }], 9)).toBeNull()
    expect(playoffTeamRow([], 9)).toBeNull()
    expect(playoffTeamRow(null, 9)).toBeNull() // request failed
    expect(playoffTeamRow([PO], undefined)).toBeNull() // no playoff season paired
  })
})

describe('AdvancedTab toggle', () => {
  const render = poRow => renderToStaticMarkup(
    <AdvancedTab teamRow={teamRow} skaters={[]} goalies={[]} abbr="MTL" loading={false}
      standings={[teamRow]} poRow={poRow} teamId={3} season={8} />
  )

  it('offers Playoffs with a playoff row', () => {
    const html = render(PO)
    expect(html).toContain('Playoffs')
    expect(html).not.toContain('Showing Regular Season stats')
  })

  it('offers no toggle without one', () => {
    const html = render(null)
    expect(html).not.toContain('🏒 Playoffs')
    expect(html).toContain('Showing Regular Season stats')
  })
})
