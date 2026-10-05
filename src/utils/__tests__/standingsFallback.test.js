// src/utils/__tests__/standingsFallback.test.js
// getStandings() when the Worker has no 'standings' key. Its KV copy
// expires every 5 minutes and /cache/standings 404s until the next poll
// refills it, so this path runs routinely. It used to read hard-coded dates
// from last season's finale: on 2026-10-05, a fresh install that landed in
// that gap got CAR's 2025-26 record (53-22-7, 113 pts) and getTeamStats()
// flipped the whole Team page to 2025-26, an hour after the same build
// showed 2026-27's 1-1-1. The NHL's /standings-season now picks the date.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { getStandings, getTeamStats, fetchLatestStandings, TEAM_CONFIG } from '../nhlApi.js'
import { clearAll } from '../cache.js'

const CURRENT = Number(TEAM_CONFIG.season)
const PRIOR = Number(`${Number(TEAM_CONFIG.season.slice(0, 4)) - 1}${TEAM_CONFIG.season.slice(0, 4)}`)

const row = (seasonId, extra = {}) => ({
  teamAbbrev: { default: 'CAR' },
  teamName: { default: 'Carolina Hurricanes' },
  seasonId,
  gamesPlayed: 3, wins: 1, losses: 1, otLosses: 1, points: 3, goalFor: 5, goalAgainst: 6,
  ...extra,
})
const priorFinale = row(PRIOR, { gamesPlayed: 82, wins: 53, losses: 22, otLosses: 7, points: 113, goalFor: 291, goalAgainst: 221 })

// Real shape of /standings-season (trimmed): one entry per season, the
// current one's standingsEnd moving forward with currentDate.
const IN_SEASON = {
  currentDate: '2026-10-05',
  seasons: [
    { id: PRIOR,   standingsStart: '2025-10-07', standingsEnd: '2026-04-17' },
    { id: CURRENT, standingsStart: '2026-09-29', standingsEnd: '2026-10-05' },
  ],
}

// standingsByDate: what /standings/<date> returns for each date.
function stubFetch({ seasons = IN_SEASON, standingsByDate = {} } = {}) {
  const fetchMock = vi.fn(async (url) => {
    const u = String(url)
    if (u.includes('/cache/')) return { ok: false, status: 404 }
    if (u.includes('/standings-season')) {
      return seasons ? { ok: true, json: async () => seasons } : { ok: false, status: 503 }
    }
    const m = u.match(/\/standings\/(\d{4}-\d{2}-\d{2})/)
    if (m) return { ok: true, json: async () => ({ standings: standingsByDate[m[1]] || [] }) }
    return { ok: false, status: 404 }
  })
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}
const datesFetched = fetchMock => fetchMock.mock.calls
  .map(([u]) => String(u).match(/\/standings\/(\d{4}-\d{2}-\d{2})/)?.[1])
  .filter(Boolean)

beforeEach(() => {
  clearAll()
  vi.spyOn(console, 'warn').mockImplementation(() => {})
  vi.spyOn(console, 'error').mockImplementation(() => {})
})
afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('getStandings without the Worker copy', () => {
  it("reads today's standings in season, not last season's finale", async () => {
    const fetchMock = stubFetch({ standingsByDate: { '2026-10-05': [row(CURRENT)], '2026-04-17': [priorFinale] } })
    const standings = await getStandings()
    expect(standings).toEqual([row(CURRENT)])
    expect(datesFetched(fetchMock)).toEqual(['2026-10-05'])
  })

  it("reads last season's final standings in the summer", async () => {
    const fetchMock = stubFetch({
      seasons: { currentDate: '2026-08-01', seasons: [IN_SEASON.seasons[0]] },
      standingsByDate: { '2026-04-17': [priorFinale] },
    })
    expect(await getStandings()).toEqual([priorFinale])
    expect(datesFetched(fetchMock)).toEqual(['2026-04-17'])
  })

  it('skips a listed season whose standings have not started yet', async () => {
    const fetchMock = stubFetch({
      seasons: { currentDate: '2026-09-20', seasons: [
        IN_SEASON.seasons[0],
        { id: CURRENT, standingsStart: '2026-09-29', standingsEnd: '2027-04-15' },
      ] },
      standingsByDate: { '2026-04-17': [priorFinale] },
    })
    expect(await getStandings()).toEqual([priorFinale])
    expect(datesFetched(fetchMock)).toEqual(['2026-04-17'])
  })

  it('never asks for standings past today', async () => {
    const fetchMock = stubFetch({
      seasons: { currentDate: '2026-10-05', seasons: [{ id: CURRENT, standingsStart: '2026-09-29', standingsEnd: '2027-04-15' }] },
      standingsByDate: { '2026-10-05': [row(CURRENT)] },
    })
    expect(await getStandings()).toEqual([row(CURRENT)])
    expect(datesFetched(fetchMock)).toEqual(['2026-10-05'])
  })

  it('is empty, not a guessed season, when /standings-season is down', async () => {
    const fetchMock = stubFetch({ seasons: null, standingsByDate: { '2026-04-17': [priorFinale] } })
    expect(await fetchLatestStandings()).toEqual([])
    expect(datesFetched(fetchMock)).toEqual([])
  })
})

describe('getTeamStats during a Worker cache gap', () => {
  it('stays on the current season once it has games', async () => {
    stubFetch({ standingsByDate: { '2026-10-05': [row(CURRENT)], '2026-04-17': [priorFinale] } })
    const stats = await getTeamStats('CAR')
    expect(stats).toMatchObject({ wins: 1, losses: 1, otLosses: 1, points: 3, isPriorSeason: false, statsSeasonId: String(CURRENT) })
  })
})
