// src/utils/__tests__/teamStats.test.js
// getTeamStats()/getTeamStatsPlayoff() never invent numbers. A team missing
// from standings used to get a hardcoded 54-20-8, 116-point season (every
// team, whenever standings failed to load), and a missing PP%/PK%/shot rate
// fell back to a made-up league average. Now: no standings row -> null,
// a missing rate -> null, and the UI says the stats aren't available.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { getTeamStats, getTeamStatsPlayoff, TEAM_CONFIG } from '../nhlApi.js'
import { clearAll } from '../cache.js'

const carRow = (extra = {}) => ({
  teamAbbrev: { default: 'CAR' },
  teamName: { default: 'Carolina Hurricanes' },
  seasonId: Number(TEAM_CONFIG.season),
  gamesPlayed: 10, wins: 6, losses: 3, otLosses: 1, points: 13,
  goalFor: 32, goalAgainst: 25,
  ...extra,
})

// A Worker KV miss (404), the NHL standings, and team/summary, the way
// _getStandings() and fetchTeamSummaryRow() read them. On a KV miss
// _getStandings() asks /standings-season which date to read standings for.
function stubFetch({ standings = [], summary = null }) {
  vi.stubGlobal('fetch', vi.fn(async (url) => {
    const u = String(url)
    if (u.includes('/cache/')) return { ok: false, status: 404 }
    if (u.includes('/standings-season')) {
      return { ok: true, json: async () => ({ currentDate: '2026-10-05', seasons: [
        { id: Number(TEAM_CONFIG.season), standingsStart: '2026-09-29', standingsEnd: '2026-10-05' },
      ] }) }
    }
    if (u.includes('/standings/')) return { ok: true, json: async () => ({ standings }) }
    if (u.includes('/team/summary')) {
      return summary ? { ok: true, json: async () => ({ data: summary }) } : { ok: false, status: 500 }
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

describe('getTeamStats', () => {
  it('is null when the team has no standings row', async () => {
    stubFetch({ standings: [] })
    expect(await getTeamStats('CAR')).toBeNull()
  })

  it('is null for a team missing from otherwise-loaded standings', async () => {
    stubFetch({ standings: [carRow()] })
    expect(await getTeamStats('BOS')).toBeNull()
  })

  it('leaves PP%, PK% and shot rates null when neither source has them', async () => {
    stubFetch({ standings: [carRow()], summary: null })
    const stats = await getTeamStats('CAR')
    expect(stats).toMatchObject({ wins: 6, losses: 3, otLosses: 1, points: 13 })
    expect(stats.goalsForPerGame).toBeCloseTo(3.2)
    expect(stats.goalsAgainstPerGame).toBeCloseTo(2.5)
    expect(stats.powerPlayPct).toBeNull()
    expect(stats.penaltyKillPct).toBeNull()
    expect(stats.shotsForPerGame).toBeNull()
    expect(stats.shotsAgainstPerGame).toBeNull()
  })

  it('converts standings PP%/PK% from 0-100 when team/summary is down', async () => {
    stubFetch({ standings: [carRow({ powerPlayPct: 23.5, penaltyKillPct: 81 })], summary: null })
    const stats = await getTeamStats('CAR')
    expect(stats.powerPlayPct).toBeCloseTo(0.235)
    expect(stats.penaltyKillPct).toBeCloseTo(0.81)
  })

  it('prefers team/summary rates', async () => {
    stubFetch({
      standings: [carRow()],
      summary: [{ teamFullName: 'Carolina Hurricanes', goalsForPerGame: 3.4, goalsAgainstPerGame: 2.4,
        powerPlayPct: 0.25, penaltyKillPct: 0.85, shotsForPerGame: 33, shotsAgainstPerGame: 26, faceoffWinPct: 0.52 }],
    })
    expect(await getTeamStats('CAR')).toMatchObject({
      goalsForPerGame: 3.4, goalsAgainstPerGame: 2.4, powerPlayPct: 0.25, penaltyKillPct: 0.85,
      shotsForPerGame: 33, shotsAgainstPerGame: 26, faceoffWinPct: 0.52,
    })
  })

  it('has no per-game rates before the first game', async () => {
    stubFetch({ standings: [carRow({ gamesPlayed: 0, wins: 0, losses: 0, otLosses: 0, points: 0, goalFor: 0, goalAgainst: 0 })] })
    const stats = await getTeamStats('CAR')
    expect(stats.gamesPlayed).toBe(0)
    expect(stats.goalsForPerGame).toBeNull()
    expect(stats.goalsAgainstPerGame).toBeNull()
  })
})

describe('getTeamStatsPlayoff', () => {
  it('leaves fields the endpoint omits null, not 0', async () => {
    stubFetch({ summary: [{ teamFullName: 'Carolina Hurricanes', teamAbbrevs: 'CAR', gamesPlayed: 4, wins: 3, losses: 1,
      goalsForPerGame: 3.25, goalsAgainstPerGame: 2 }] })
    const stats = await getTeamStatsPlayoff('CAR')
    expect(stats).toMatchObject({ gamesPlayed: 4, wins: 3, losses: 1, goalsForPerGame: 3.25, goalsAgainstPerGame: 2 })
    expect(stats.powerPlayPct).toBeNull()
    expect(stats.penaltyKillPct).toBeNull()
    expect(stats.shotsForPerGame).toBeNull()
    expect(stats.shotsAgainstPerGame).toBeNull()
  })
})
