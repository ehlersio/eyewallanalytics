// The landing page's scorecard tiles (components/landing/scorecardTiles.js),
// from the shape the Worker's /scorecard returned on 2026-10-19.
import { describe, it, expect } from 'vitest'
import { scorecardTiles, formatMetric } from '../landing/scorecardTiles'

const live = (o) => ({ status: 'ok', period: '2026-27', ...o })

const DATA = {
  models: {
    game_winner: { live: live({ n: 136, accuracy: 0.6029, brier: 0.2335, baseline: { name: 'home_team_wins', accuracy: 0.5662, brier: 0.2456 } }) },
    starting_goalie: { live: live({ n: 194, accuracy: 0.7165, brier: 0.395, baseline: { name: 'last_games_starter', accuracy: 0.4053, brier: null } }) },
    playoff_odds: {
      live: { status: 'pending', n: 0, period: '2026-27', accuracy: null, brier: null, baseline: null },
      backtest: { status: 'ok', n: 384, period: '2023-24 to 2025-26', accuracy: 0.7161, brier: 0.1615, baseline: { name: 'holds_a_playoff_spot', accuracy: 0.7135, brier: 0.224 } },
    },
  },
}

describe('scorecardTiles', () => {
  it('uses the live record where it has graded predictions', () => {
    const [winners, goalies] = scorecardTiles(DATA)
    expect(winners).toMatchObject({ model: 'game_winner', kind: 'live', value: '60.3%', n: 136, baseline: { name: 'home_team_wins', value: '56.6%' } })
    expect(goalies).toMatchObject({ model: 'starting_goalie', kind: 'live', value: '71.7%', baseline: { name: 'last_games_starter', value: '40.5%' } })
  })

  it('falls back to the backtest while the live record is pending, scored by Brier for playoff odds', () => {
    const odds = scorecardTiles(DATA)[2]
    expect(odds).toMatchObject({ model: 'playoff_odds', kind: 'backtest', metric: 'brier', value: '0.162', n: 384, period: '2023-24 to 2025-26', baseline: { value: '0.224' } })
  })

  it('leaves out a model with nothing graded', () => {
    const data = { models: { ...DATA.models, game_winner: { live: { status: 'pending', n: 0 } } } }
    expect(scorecardTiles(data).map(t => t.model)).toEqual(['starting_goalie', 'playoff_odds'])
  })

  it('drops a baseline without a value for the metric', () => {
    const data = { models: { starting_goalie: { live: live({ n: 5, accuracy: 0.6, baseline: { name: 'x', accuracy: null } }) } } }
    expect(scorecardTiles(data)[0].baseline).toBeNull()
  })

  it('is empty for a failed fetch', () => {
    expect(scorecardTiles(null)).toEqual([])
    expect(scorecardTiles({})).toEqual([])
  })
})

describe('formatMetric', () => {
  it('formats accuracy as a percentage and Brier to three places', () => {
    expect(formatMetric('accuracy', 0.6029)).toBe('60.3%')
    expect(formatMetric('brier', 0.1615)).toBe('0.162')
    expect(formatMetric('brier', null)).toBeNull()
  })
})
