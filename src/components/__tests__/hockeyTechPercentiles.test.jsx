// src/components/__tests__/hockeyTechPercentiles.test.jsx
// AHL/ECHL percentile radar (Phase 3 B8, contract C4): the popup shows the
// radar only for a player the routes rank (they answer everyone else with
// every `pct` null), and per-game-played rates (rateBasis 'perGP') say so.
// The empty answer is the real /ahl/player/percentiles?id=8744&season=90
// response on 2026-10-07, before the pipeline backfill.

import { describe, it, expect, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'

vi.mock('../../utils/seasonClient', () => ({
  fetchSeasonsConfig: vi.fn(() => Promise.reject(new Error('offline in tests'))),
  fetchComparisonSeasons: vi.fn(() => Promise.reject(new Error('offline in tests'))),
  fetchLeagueSeasons: vi.fn(() => Promise.reject(new Error('offline in tests'))),
}))

import i18n from '../../i18n/index.js'
import { hasPercentileData } from '../HockeyTechPlayerPopup.jsx'
import PercentileHeaderPanel from '../PercentileHeaderPanel.jsx'
import { computeGoalieRadarAxes } from '../../utils/pwhlPlayerStats.js'
import { AHL, ECHL } from '../../utils/hockeyTechLeagues.js'

const EMPTY = {
  player_id: 8744, team_id: null, season_id: 90, season_type: null, toi_per_game: null, xg_for: null, finishing: null, rateBasis: 'perGP',
  percentiles: {
    goals: { pct: null, label: 'Goals', note: 'Percentile rank vs league, goals, per game played' },
    a1: { pct: null, label: '1st Assists', note: 'Percentile rank vs league, primary assists, per game played' },
    penalties: { pct: null, label: 'Penalties', note: 'Percentile rank vs league, penalty discipline, per game played' },
    finishing: { pct: null, label: 'Finishing', note: 'Percentile rank vs league, goals above xGoals, per game played' },
  },
}
const RANKED = { ...EMPTY, percentiles: { ...EMPTY.percentiles, goals: { ...EMPTY.percentiles.goals, pct: 91 }, a1: { ...EMPTY.percentiles.a1, pct: 74 } } }

describe('hasPercentileData', () => {
  it('is false for the routes\' all-null answer, a missing answer or none at all', () => {
    expect(hasPercentileData(EMPTY)).toBe(false)
    expect(hasPercentileData({ percentiles: null })).toBe(false)
    expect(hasPercentileData(null)).toBe(false)
  })
  it('is true once any category is ranked', () => {
    expect(hasPercentileData(RANKED)).toBe(true)
  })
})

describe('AHL/ECHL league objects', () => {
  it('turn the percentile radar on and fetch the C4 routes', () => {
    for (const league of [AHL, ECHL]) {
      expect(league.playerPopup).toMatchObject({ percentiles: true, comparisonEntry: true })
      expect(league.playerPopup.HeaderPanel).toBe(PercentileHeaderPanel)
      expect(league.api.fetchPlayerPercentiles).toBeTypeOf('function')
      expect(league.api.fetchGoaliePercentiles).toBeTypeOf('function')
    }
  })
})

describe('per-game rates', () => {
  it('label the goalie GSAX rate per game', () => {
    expect(computeGoalieRadarAxes({}, { perGame: true })[1].axis).toBe('GSAX/GP')
    expect(computeGoalieRadarAxes({})[1].axis).toBe('GSAX/60')
  })

  it('say so under the radar, and show GP where there is no TOI', async () => {
    await i18n.changeLanguage('en')
    const html = renderToStaticMarkup(
      <PercentileHeaderPanel isGoalie={false} percentiles={RANKED.percentiles} rateBasis="perGP" boxStats={{ goals: 5, assists: 3, points: 8, gp: 6 }} teamColor="#c00" />
    )
    expect(html).toContain(i18n.t('playerPopup.radar.perGameNote'))
    expect(html).toContain('>GP<')
    expect(html).not.toContain('>TOI<')
  })

  it('leave the PWHL per-60 panel as it was', () => {
    const html = renderToStaticMarkup(
      <PercentileHeaderPanel isGoalie={false} percentiles={RANKED.percentiles} boxStats={{ goals: 5, toi_per_game: '1080' }} teamColor="#c00" />
    )
    expect(html).not.toContain(i18n.t('playerPopup.radar.perGameNote'))
    expect(html).toContain('>TOI<')
  })
})
