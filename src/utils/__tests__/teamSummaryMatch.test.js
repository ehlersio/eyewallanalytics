// src/utils/__tests__/teamSummaryMatch.test.js
// NHL team/summary rows matched by team id, and what that feeds, against
// the real 2026-27 team/summary and standings (2026-10-05):
//   #27 the Team page's rank badges never appeared for NYI, NYR and SJS --
//       'NY Islanders', 'NY Rangers' and 'San José' aren't substrings of
//       the names team/summary returns.
//   #25 Power rankings' Special Teams component read PP%/PK% from
//       standings, which carry neither, so it was 0 for every team.
//   #26 the Standings STRK cell turned OT streaks into red L streaks.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { findTeamSummaryRow, getTeamByAbbr, ALL_TEAMS } from '../teamConfig.js'
import { getTeamSeasonRankings, getTeamSpecialTeams } from '../nhlApi.js'
import { computePowerRankings, standingsStreak } from '../leagueUtils.js'
import { clearAll } from '../cache.js'
import summary from './fixtures/nhl-audit-2026-10-05/team-summary-20262027.json'
import standingsFx from './fixtures/nhl-audit-2026-10-05/standings-20262027.json'

const SEASON = '20262027'
const rows = summary.data
const standings = standingsFx.standings

function stubSummary(data) {
  vi.stubGlobal('fetch', vi.fn(async (url) => {
    if (String(url).includes('/team/summary')) {
      return data ? { ok: true, json: async () => ({ data }) } : { ok: false, status: 500 }
    }
    return { ok: false, status: 404 }
  }))
}

beforeEach(() => {
  clearAll()
  vi.spyOn(console, 'warn').mockImplementation(() => {})
})
afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('findTeamSummaryRow', () => {
  it('finds NYI, NYR and SJS (the old name fragments matched nothing)', () => {
    expect(findTeamSummaryRow(rows, 'NYI').teamFullName).toBe('New York Islanders')
    expect(findTeamSummaryRow(rows, 'NYR').teamFullName).toBe('New York Rangers')
    expect(findTeamSummaryRow(rows, 'SJS').teamFullName).toBe('San Jose Sharks')
    // The old match: none of these fragments is in the NHL's names.
    for (const abbr of ['NYI', 'NYR', 'SJS']) {
      const fragment = getTeamByAbbr(abbr).fullNameFragment
      expect(rows.some(r => r.teamFullName.includes(fragment))).toBe(false)
    }
  })

  it('finds every one of the 32 teams by id', () => {
    for (const team of ALL_TEAMS) {
      expect(findTeamSummaryRow(rows, team.abbr)?.teamId).toBe(team.teamId)
    }
  })

  it('falls back to the exact full name for a row without an id', () => {
    const noIds = rows.map(({ teamId: _id, ...r }) => r)
    expect(findTeamSummaryRow(noIds, 'CAR').teamFullName).toBe('Carolina Hurricanes')
    expect(findTeamSummaryRow(noIds, 'XXX')).toBeNull()
  })
})

describe('getTeamSeasonRankings', () => {
  it('ranks the Islanders (no badges before)', async () => {
    stubSummary(rows)
    const nyi = getTeamByAbbr('NYI')
    const ranks = await getTeamSeasonRankings(2, SEASON, nyi)
    const row = findTeamSummaryRow(rows, 'NYI')
    const better = rows.filter(r => r.powerPlayPct > row.powerPlayPct).length
    expect(ranks.teamCount).toBe(32)
    expect(ranks.ppPct).toBe(better + 1)
    for (const key of ['goalsForPG', 'goalsAgainstPG', 'pkPct', 'shotsForPG', 'shotsAgainstPG']) {
      expect(ranks[key]).toBeGreaterThanOrEqual(1)
      expect(ranks[key]).toBeLessThanOrEqual(32)
    }
  })

  it('is null when team/summary is down', async () => {
    stubSummary(null)
    expect(await getTeamSeasonRankings(2, SEASON, getTeamByAbbr('SJS'))).toBeNull()
  })
})

describe('Power rankings Special Teams', () => {
  it("uses each team's real PP% and PK% from team/summary", async () => {
    stubSummary(rows)
    const st = await getTeamSpecialTeams(SEASON)
    expect(Object.keys(st)).toHaveLength(32)
    expect(st.CAR).toEqual({ ppPct: 0.1875, pkPct: 0.923077 })

    const ranked = computePowerRankings(standings, {}, st)
    const car = ranked.find(t => t.abbr === 'CAR')
    expect(car.spPct).toBeCloseTo((0.1875 + 0.923077) / 2)
    expect(new Set(ranked.map(t => t.spPct)).size).toBeGreaterThan(1)
    expect(ranked.every(t => t.leagueRanks.sp >= 1 && t.leagueRanks.sp <= 32)).toBe(true)
  })

  it('is left out (null), never 0, when team/summary is down', async () => {
    stubSummary(null)
    const st = await getTeamSpecialTeams(SEASON)
    expect(st).toEqual({})
    const ranked = computePowerRankings(standings, {}, st)
    expect(ranked.every(t => t.spPct === null && t.ppPct === null && t.pkPct === null)).toBe(true)
    expect(ranked.every(t => t.leagueRanks.sp === undefined)).toBe(true)
  })

  it('changes the order when special teams count', () => {
    const st = {}
    for (const team of ALL_TEAMS) {
      const r = findTeamSummaryRow(rows, team.abbr)
      st[team.abbr] = { ppPct: r.powerPlayPct, pkPct: r.penaltyKillPct }
    }
    const withSp = computePowerRankings(standings, {}, st)
    const without = computePowerRankings(standings, {}, {})
    const scoreGap = withSp.map(t => t.score - without.find(w => w.abbr === t.abbr).score)
    expect(scoreGap.some(g => g > 0)).toBe(true)
  })
})

describe('standingsStreak', () => {
  const row = abbr => standings.find(s => s.teamAbbrev.default === abbr)

  it("shows FLA's overtime-loss streak as OT2, not L2", () => {
    expect(row('FLA')).toMatchObject({ wins: 1, losses: 0, otLosses: 2 })
    expect(standingsStreak(row('FLA'))).toMatchObject({ label: 'OT2', tone: 'ot' })
    expect(standingsStreak(row('MTL'))).toMatchObject({ label: 'OT1', tone: 'ot' })
    expect(standingsStreak(row('LAK'))).toMatchObject({ label: 'OT1', tone: 'ot' })
  })

  it('keeps W and L', () => {
    expect(standingsStreak(row('CAR'))).toMatchObject({ label: 'W1', tone: 'win' })
    expect(standingsStreak({ streakCode: 'L', streakCount: 3 })).toMatchObject({ label: 'L3', tone: 'loss' })
    expect(standingsStreak({ streakCode: null, streakCount: 0 })).toBeNull()
  })
})
