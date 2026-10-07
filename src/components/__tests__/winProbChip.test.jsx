// src/components/__tests__/winProbChip.test.jsx
// PWHL/AHL/ECHL schedule cards show the NHL GameCard's Elo chip when the
// Worker's schedule row carries `winProb` (contract C6; only rows with a
// {league}_game_win_probs row have it), and nothing otherwise. The AHL
// row is real: /ahl/schedule?teamId=319&season=94 (2026-10-07), game
// 1029081, HER home to CLT, winProb { home: .4966, away: .5034 }.

import { describe, it, expect, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'

vi.mock('../../utils/seasonClient', () => ({
  fetchSeasonsConfig: vi.fn(() => Promise.reject(new Error('offline in tests'))),
  fetchComparisonSeasons: vi.fn(() => Promise.reject(new Error('offline in tests'))),
}))

import '../../i18n/index.js'
import WinProbChip, { winProbChipData } from '../WinProbChip.jsx'
import { GameCard } from '../../views/hockeytech/HockeyTechScheduleView.jsx'
import { AHL } from '../../utils/hockeyTechLeagues.js'

const textOf = el => renderToStaticMarkup(el).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
const WP = { home: 0.4966, away: 0.5034, source: 'elo' }

describe('winProbChipData', () => {
  it('shows the followed team when it is the more likely winner', () => {
    expect(winProbChipData({ home: 0.62, away: 0.38 }, true, 'HER', 'CLT')).toEqual({ favoured: true, pct: 62, abbr: 'HER' })
    expect(winProbChipData({ home: 0.38, away: 0.62 }, false, 'HER', 'CLT')).toEqual({ favoured: true, pct: 62, abbr: 'HER' })
  })

  it('shows the opponent otherwise', () => {
    expect(winProbChipData({ home: 0.43, away: 0.57 }, true, 'HER', 'CLT')).toEqual({ favoured: false, pct: 57, abbr: 'CLT' })
    expect(winProbChipData({ home: 0.7, away: 0.3 }, false, 'HER', 'CLT')).toEqual({ favoured: false, pct: 70, abbr: 'CLT' })
  })

  it('is nothing without a usable winProb', () => {
    expect(winProbChipData(undefined, true, 'HER', 'CLT')).toBeNull()
    expect(winProbChipData({ home: null, away: null }, true, 'HER', 'CLT')).toBeNull()
  })
})

describe('WinProbChip', () => {
  it('renders the NHL chip classes and a neutral title', () => {
    const html = renderToStaticMarkup(<WinProbChip winProb={{ home: 0.62, away: 0.38 }} isHome abbr="HER" oppAbbr="CLT" />)
    expect(html).toContain('gc-favoured-chip')
    expect(html).toContain('✓ HER 62%')
    expect(html).toContain('title="Elo win probability: HER 62% likely to win"')
  })
})

describe('AHL/ECHL schedule card', () => {
  const upcoming = { game_id: 1029081, season_id: 94, game_date: '2026-10-03', home_team_id: 319, away_team_id: 384, home_score: 0, away_score: 0, game_state: '7:00 pm EDT', venue_name: 'Giant Center' }

  // .4966 rounds to 50%: the followed team's side, as the NHL chip rounds
  // (teamWinPct) and decides (>= 50).
  it('shows the chip on an upcoming game with winProb', () => {
    expect(textOf(<GameCard league={AHL} game={{ ...upcoming, winProb: WP }} teamId={319} abbr="HER" onClick={() => {}} />)).toContain('✓ HER 50%')
    expect(textOf(<GameCard league={AHL} game={{ ...upcoming, winProb: { home: 0.41, away: 0.59 } }} teamId={319} abbr="HER" onClick={() => {}} />)).toContain('⚠ CLT 59%')
  })

  it('shows none without winProb, or once the game is final', () => {
    expect(renderToStaticMarkup(<GameCard league={AHL} game={upcoming} teamId={319} abbr="HER" onClick={() => {}} />)).not.toContain('win-prob-chip')
    const final = { ...upcoming, game_state: 'Final', home_score: 2, away_score: 5, winProb: WP }
    expect(renderToStaticMarkup(<GameCard league={AHL} game={final} teamId={319} abbr="HER" onClick={() => {}} />)).not.toContain('win-prob-chip')
  })
})
