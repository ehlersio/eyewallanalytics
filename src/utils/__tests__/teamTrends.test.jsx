// src/utils/__tests__/teamTrends.test.jsx
// Team > Trends (audit 2026-10-05 #8), against CAR's real 2026-27
// club-schedule-season: 4 finished preseason games (L, W/SO, W, W) and a
// 1-1-1 regular-season start (OTL vs FLA, L vs WSH, W in OT at PHI). The
// tab used to show the preseason games and "Last 10 games 4–6, 40%".

import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import i18n from '../../i18n/index.js'
import { buildTeamGameLog, recentRecord, currentStreak } from '../teamTrends.js'
import { TrendsTab } from '../../views/TeamView.jsx'
import schedule from './fixtures/nhl-audit-2026-10-05/car-club-schedule-season-20262027.json'

const en = i18n.getFixedT('en')

beforeAll(() => {
  const error = console.error
  vi.spyOn(console, 'error').mockImplementation((msg, ...rest) => {
    if (!String(msg).includes('useLayoutEffect does nothing on the server')) error(msg, ...rest)
  })
})
afterAll(() => vi.restoreAllMocks())

const regular = buildTeamGameLog(schedule.games, 'CAR', 2)

describe('buildTeamGameLog', () => {
  it('keeps only finished regular-season games, oldest first', () => {
    expect(regular.map(g => g.gameId)).toEqual([2026020001, 2026020018, 2026020025])
    expect(regular.map(g => g.result)).toEqual(['OTL', 'L', 'W'])
    expect(regular[0]).toMatchObject({ opp: 'FLA', home: true, carScore: 0, oppScore: 1, ot: true })
    expect(regular[2]).toMatchObject({ opp: 'PHI', home: false, carScore: 3, oppScore: 2, won: true })
  })

  it('never includes preseason games', () => {
    const ids = regular.map(g => String(g.gameId))
    expect(ids.some(id => id.slice(4, 6) === '01')).toBe(false)
    expect(buildTeamGameLog(schedule.games, 'CAR', 1)).toHaveLength(4)
  })

  it('has no playoff games in October', () => {
    expect(buildTeamGameLog(schedule.games, 'CAR', 3)).toEqual([])
  })

  it('calls a playoff loss in overtime a loss, not an OTL', () => {
    const po = schedule.games
      .filter(g => g.id === 2026020001)
      .map(g => ({ ...g, id: 2026030111, gameType: 3 }))
    expect(buildTeamGameLog(po, 'CAR', 3)[0].result).toBe('L')
  })
})

describe('recentRecord / currentStreak', () => {
  it('counts the games actually played (1-1-1, 33%), not 10', () => {
    expect(recentRecord(regular, 10)).toEqual({ games: 3, wins: 1, losses: 1, otLosses: 1, winPct: 33 })
  })

  it('is empty, not 0%, with no games', () => {
    expect(recentRecord([], 10)).toEqual({ games: 0, wins: 0, losses: 0, otLosses: 0, winPct: null })
    expect(currentStreak([])).toBeNull()
  })

  it('gives the streak as W / L / OT', () => {
    expect(currentStreak(regular)).toEqual({ code: 'W', count: 1 })
    expect(currentStreak(regular.slice(0, 1))).toEqual({ code: 'OT', count: 1 })
    expect(currentStreak(regular.slice(0, 2))).toEqual({ code: 'L', count: 1 })
  })
})

describe('TrendsTab', () => {
  it('shows CAR as 1–1–1 over its last 3 games', () => {
    const html = renderToStaticMarkup(<TrendsTab gameLogReg={regular} gameLogPO={[]} loading={false} />)
    expect(html).toContain(en('team.lastNGames', { count: 3 }))
    expect(html).toContain('1–1–1')
    expect(html).toContain(`${en('teamView.trends.winPctLastN', { count: 3 })}`)
    expect(html).toContain('>33%<')
    expect(html).not.toContain('Last 10 games')
    expect(html).not.toContain('4–6')
    expect(html).not.toContain('>40%<')
  })

  it('offers no Playoffs choice without playoff games', () => {
    const html = renderToStaticMarkup(<TrendsTab gameLogReg={regular} gameLogPO={[]} loading={false} />)
    expect(html).not.toContain(en('team.playoffsToggle'))
    expect(html).toContain(en('team.showingRegularSeason'))
  })

  it('says there are no regular-season games yet instead of loading forever', () => {
    const html = renderToStaticMarkup(<TrendsTab gameLogReg={[]} gameLogPO={[]} loading={false} />)
    expect(html).toContain(en('teamView.trends.noRegularSeasonGames').replace(/'/g, '&#x27;'))
    expect(html).not.toContain(en('teamView.trends.loadingGameLog'))
  })
})
