// src/utils/__tests__/hockeyTechTrends.test.jsx
// PWHL/AHL/ECHL Team > Trends quick stats: the last-10 record is W–L–OTL
// over the games actually played, the same as the Worker's standings L10.
// PWHL used to show W–(10−W) and W/10 -- BOS's 7-1-2 finish read "7–3",
// and a team 3 games in read "3–7, 30%".
//
// Fixtures are the Worker's real answers on 2026-10-06
// (fixtures/team-trends-2026-10-06/): every PWHL team's 2025-26 schedule
// (season 8) and standings, ECHL Toledo's (68) 2025-26 schedule and
// standings row, and AHL Texas's (380) standings row for 2026-27 (94),
// whose schedule is fixtures/ahl-tex-2026-27 (a shootout win, then a
// shootout loss).

import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest'

vi.mock('../seasonClient', () => ({
  fetchSeasonsConfig: vi.fn(() => Promise.reject(new Error('offline in tests'))),
  fetchComparisonSeasons: vi.fn(() => Promise.reject(new Error('offline in tests'))),
}))

import { renderToStaticMarkup } from 'react-dom/server'
import i18n from '../../i18n/index.js'
import { gameResultFor } from '../hockeyTechResults.js'
import { recentRecord } from '../teamTrends.js'
import { TrendsTab as PWHLTrendsTab } from '../../views/PWHLTeamView.jsx'
import { TrendsTab as AHLTrendsTab } from '../../views/AHLTeamView.jsx'
import { TrendsTab as ECHLTrendsTab } from '../../views/ECHLTeamView.jsx'
import pwhlSchedules from './fixtures/team-trends-2026-10-06/pwhl-schedules-8.json'
import pwhlStandings from './fixtures/team-trends-2026-10-06/pwhl-standings-8.json'
import echlSchedule from './fixtures/team-trends-2026-10-06/echl-schedule-68-73.json'
import echlStandings from './fixtures/team-trends-2026-10-06/echl-standings-73-team-68.json'
import ahlStandings from './fixtures/team-trends-2026-10-06/ahl-standings-94-team-380.json'
import texSchedule from './fixtures/ahl-tex-2026-27/schedule.json'

const en = i18n.getFixedT('en')

beforeAll(() => {
  const error = console.error
  vi.spyOn(console, 'error').mockImplementation((msg, ...rest) => {
    if (!String(msg).includes('useLayoutEffect does nothing on the server')) error(msg, ...rest)
  })
})
afterAll(() => vi.restoreAllMocks())

// The game log the Trends tabs build: finished games, oldest first.
const logFor = (schedule, teamId) => schedule
  .filter(g => g.game_state === 'Final')
  .sort((a, b) => a.game_id - b.game_id)
  .map(g => gameResultFor(g, teamId))

const l10 = r => ({ wins: r.l10W, losses: r.l10L, otLosses: r.l10OTL })

describe('PWHL results', () => {
  it('reads the ot/shootout flags: an OT/SO loss is an OTL, an OT/SO win a W', () => {
    const so = pwhlSchedules['1'].find(g => g.game_id === 237)
    expect(so.shootout).toBe(true)
    const home = gameResultFor(so, so.home_team_id)
    const away = gameResultFor(so, so.away_team_id)
    expect([home.endedIn, away.endedIn]).toEqual(['SO', 'SO'])
    expect([home.result, away.result].sort()).toEqual(['OTL', 'W'])

    const ot = pwhlSchedules['1'].find(g => g.game_id === 318) // BOS lost 3-2 in OT at MTL
    expect(gameResultFor(ot, 1)).toEqual({ won: false, result: 'OTL', endedIn: 'OT', my: 2, op: 3 })
  })

  it('gives every team the standings\' last-10 record (W–L–OTL)', () => {
    expect(pwhlStandings).toHaveLength(8)
    for (const row of pwhlStandings) {
      const recent = recentRecord(logFor(pwhlSchedules[String(row.team_id)], row.team_id), 10)
      expect({ team: row.team_id, ...recent }).toEqual({
        team: row.team_id, games: 10, ...l10(row), winPct: row.l10W * 10,
      })
    }
  })
})

describe('PWHL TrendsTab', () => {
  it('shows BOS 7–1–2 over its last 10, 70%', () => {
    const html = renderToStaticMarkup(<PWHLTrendsTab schedule={pwhlSchedules['1']} teamId={1} loading={false} />)
    expect(html).toContain(en('team.lastNGames', { count: 10 }))
    expect(html).toContain('>7–1–2<')
    expect(html).toContain(en('teamView.trends.winPctLastN', { count: 10 }))
    expect(html).toContain('>70%<')
    expect(html).not.toContain('>7–3<')
  })

  it('counts only the games played three games in (3–0–0, 100%), not 10', () => {
    const firstThree = [...pwhlSchedules['1']].sort((a, b) => a.game_id - b.game_id).slice(0, 3)
    const html = renderToStaticMarkup(<PWHLTrendsTab schedule={firstThree} teamId={1} loading={false} />)
    expect(html).toContain(en('team.lastNGames', { count: 3 }))
    expect(html).toContain('>3–0–0<')
    expect(html).toContain('>100%<')
    expect(html).not.toContain('>3–7<')
    expect(html).not.toContain('>30%<')
  })

  it('keeps marking OT/SO wins apart in the result dots', () => {
    const html = renderToStaticMarkup(<PWHLTrendsTab schedule={pwhlSchedules['1']} teamId={1} loading={false} />)
    expect(html).toContain('title="OTL 2–3"') // 318, the OT loss at MTL
  })
})

describe('AHL TrendsTab', () => {
  it('shows TEX 1–0–1 over its 2 games, like the standings', () => {
    expect(recentRecord(logFor(texSchedule, 380), 10)).toMatchObject({ games: 2, ...l10(ahlStandings[0]) })
    const html = renderToStaticMarkup(<AHLTrendsTab schedule={texSchedule} teamId={380} loading={false} />)
    expect(html).toContain(en('team.lastNGames', { count: 2 }))
    expect(html).toContain('>1–0–1<')
    expect(html).toContain(en('teamView.trends.winPctLastN', { count: 2 }))
    expect(html).toContain('>50%<')
    expect(html).not.toContain('Last 10 games')
  })
})

describe('ECHL TrendsTab', () => {
  it('shows Toledo\'s last 10 of 2025-26 as the standings do (8–1–1)', () => {
    expect(echlSchedule.every(g => g.season_id === 73)).toBe(true)
    expect(recentRecord(logFor(echlSchedule, 68), 10)).toEqual({ games: 10, ...l10(echlStandings[0]), winPct: 80 })
    const html = renderToStaticMarkup(<ECHLTrendsTab schedule={echlSchedule} teamId={68} loading={false} />)
    expect(html).toContain(en('team.lastNGames', { count: 10 }))
    expect(html).toContain('>8–1–1<')
    expect(html).toContain('>80%<')
  })
})
