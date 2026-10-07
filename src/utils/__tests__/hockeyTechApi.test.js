// src/utils/__tests__/hockeyTechApi.test.js
// createHockeyTechApi(key): one Worker client for AHL and ECHL. Every fetch
// hits /{key}/..., goes through fetchWithRetry with its default 8s budget
// and the browser's HTTP cache (no `cache: 'no-store'`: the Worker's
// Cache-Control/ETag decide -- workerCache.js), defaults the season to the league's live current
// season and the team to the stored one, and resolves to null on failure.
import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest'

vi.mock('../seasonClient', () => ({ fetchSeasonsConfig: vi.fn(() => Promise.reject(new Error('offline'))) }))
const fetchWithRetry = vi.fn()
vi.mock('../retryFetch', async (orig) => ({ ...(await orig()), fetchWithRetry: (...a) => fetchWithRetry(...a) }))

let createHockeyTechApi, ahlApi, echlApi, ahlConfig, echlConfig, retry
beforeAll(async () => {
  vi.stubEnv('VITE_WORKER_URL', 'https://worker.test')
  globalThis.localStorage = { getItem: k => (k === 'eyewall:ahl_team' ? JSON.stringify({ abbr: 'HER', teamId: 319 }) : null) }
  ;({ createHockeyTechApi } = await import('../hockeyTechApi.js'))
  ahlApi = await import('../ahlApi.js')
  echlApi = await import('../echlApi.js')
  ahlConfig = await import('../ahlConfig.js')
  echlConfig = await import('../echlConfig.js')
  retry = await vi.importActual('../retryFetch.js')
})

const ok = body => ({ ok: true, status: 200, json: async () => body })
beforeEach(() => {
  fetchWithRetry.mockReset()
  fetchWithRetry.mockImplementation(async () => ok([]))
})
const urls = () => fetchWithRetry.mock.calls.map(([u]) => u)

describe.each([['ahl'], ['echl']])('%s client', (key) => {
  const current = () => (key === 'ahl' ? ahlConfig.AHL_CURRENT_SEASON : echlConfig.ECHL_CURRENT_SEASON)

  it('sends every request to /<key>/ through the HTTP cache with the default 8s budget', async () => {
    const api = createHockeyTechApi(key)
    await api.fetchStandings(90)
    expect(fetchWithRetry).toHaveBeenCalledWith(`https://worker.test/${key}/standings?season=90`, { init: {} })
    expect(retry.FETCH_TIMEOUT_MS).toBe(8000)
  })

  it('builds each route', async () => {
    const api = createHockeyTechApi(key)
    await api.fetchLeaguePlayers(1)
    await api.fetchPlayers(2, 3)
    await api.fetchShots(2, 3)
    await api.fetchLastGame(2, 3)
    await api.fetchTeamSeasonsCompare(2, [3, 4])
    await api.fetchTeamSeasonsCompareTeams(2, 5, 3)
    await api.fetchTeamHeadToHead(2, 5)
    await api.fetchGameBox(6)
    await api.fetchGameSummary(6)
    await api.fetchPreview(6)
    await api.fetchTeamSeasonSummary(2, 3)
    await api.fetchGameShots(6)
    await api.fetchSchedule(2, 3)
    await api.fetchRoster(2)
    await api.fetchPlayerLanding(7, 3)
    await api.fetchPlayerGameLog(7, 3)
    await api.fetchPlayerCareer(7)
    await api.fetchPlayerShots(7, 3)
    await api.fetchToday(3)
    await api.fetchLive(6)
    const b = `https://worker.test/${key}`
    expect(urls()).toEqual([
      `${b}/league-players?season=1`,
      `${b}/players?teamId=2&season=3`,
      `${b}/shots?teamId=2&season=3`,
      `${b}/lastgame?teamId=2&season=3`,
      `${b}/team-seasons/compare?teamId=2&seasons=3,4`,
      `${b}/team-seasons/compare-teams?teamIds=2,5&season=3`,
      `${b}/team-seasons/head-to-head?teamIds=2,5`,
      `${b}/game-box?gameId=6`,
      `${b}/summary?gameId=6`,
      `${b}/preview?gameId=6`,
      `${b}/team-season-summary?teamId=2&season=3`,
      `${b}/game-shots?gameId=6`,
      `${b}/schedule?teamId=2&season=3`,
      `${b}/roster?teamId=2`,
      `${b}/player/landing?id=7&season=3`,
      `${b}/player-game-log?playerId=7&season=3`,
      `${b}/player/career?id=7`,
      `${b}/player-shots?playerId=7&season=3`,
      `${b}/today?season=3`,
      `${b}/live/6`,
    ])
  })

  it('defaults the season to the live current season and the team to the stored one', async () => {
    const api = createHockeyTechApi(key)
    await api.fetchToday()
    await api.fetchStandings()
    expect(urls()).toEqual([
      `https://worker.test/${key}/today?season=${current()}`,
      `https://worker.test/${key}/standings?season=${current()}`,
    ])
    fetchWithRetry.mockClear()
    await api.fetchSchedule()
    if (key === 'ahl') expect(urls()).toEqual([`https://worker.test/ahl/schedule?teamId=319&season=${current()}`])
    else expect(urls()).toEqual([]) // no ECHL team stored: no request, null
  })

  it('makes no request without the ids it needs', async () => {
    const api = createHockeyTechApi(key)
    expect(await api.fetchGameBox()).toBeNull()
    expect(await api.fetchPlayerGameLog(7)).toBeNull()
    expect(await api.fetchTeamSeasonsCompare(2, [])).toEqual([])
    expect(await api.fetchTeamSeasonsCompareTeams(2, null, 3)).toEqual([])
    expect(fetchWithRetry).not.toHaveBeenCalled()
  })

  it('resolves to null on an HTTP error or a thrown fetch', async () => {
    const api = createHockeyTechApi(key)
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    vi.spyOn(console, 'error').mockImplementation(() => {})
    fetchWithRetry.mockImplementationOnce(async () => ({ ok: false, status: 500 }))
    expect(await api.fetchPreview(6)).toBeNull()
    fetchWithRetry.mockImplementationOnce(async () => { throw new Error('timeout') })
    expect(await api.fetchPreview(6)).toBeNull()
    // A failed compare is unknown (null), not "no seasons" ([]).
    fetchWithRetry.mockImplementationOnce(async () => ({ ok: false, status: 500 }))
    expect(await api.fetchTeamSeasonsCompare(2, [3])).toBeNull()
  })

  // The League view's Leaders tab and the player popup's rank badges share
  // one fetch per season (cache.js); a failure isn't kept.
  it('fetchLeaguePlayers shares one fetch per season and retries after a failure', async () => {
    const api = createHockeyTechApi(key)
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    fetchWithRetry.mockImplementationOnce(async () => ({ ok: false, status: 503 }))
    expect(await api.fetchLeaguePlayers(4242)).toBeNull()
    fetchWithRetry.mockImplementationOnce(async () => ok({ skaters: [], goalies: [] }))
    expect(await api.fetchLeaguePlayers(4242)).toEqual({ skaters: [], goalies: [] })
    expect(await api.fetchLeaguePlayers(4242)).toEqual({ skaters: [], goalies: [] })
    expect(urls().filter(u => u.endsWith('league-players?season=4242'))).toHaveLength(2)
  })

  // The News view shows its own error card, so its fetch throws instead.
  it('fetchNews returns the articles, and throws on failure', async () => {
    const api = createHockeyTechApi(key)
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    vi.spyOn(console, 'error').mockImplementation(() => {})
    fetchWithRetry.mockImplementationOnce(async () => ok([{ id: 'a' }]))
    expect(await api.fetchNews()).toEqual([{ id: 'a' }])
    expect(fetchWithRetry).toHaveBeenLastCalledWith(`https://worker.test/${key}/news`, { init: {} })

    fetchWithRetry.mockImplementationOnce(async () => ok([]))
    await api.fetchNews({ fresh: true })
    expect(fetchWithRetry).toHaveBeenLastCalledWith(`https://worker.test/${key}/news`, { init: { cache: 'no-cache' } })

    fetchWithRetry.mockImplementationOnce(async () => ({ ok: false, status: 503 }))
    await expect(api.fetchNews()).rejects.toMatchObject({ status: 503 })
    fetchWithRetry.mockImplementationOnce(async () => { throw new Error('timeout') })
    await expect(api.fetchNews()).rejects.toThrow('timeout')
  })

  it('normalizes compare rows, folding shootout losses into OTL', async () => {
    const api = createHockeyTechApi(key)
    const row = { season_id: 3, team_id: 2, gp: 10, wins: 5, losses: 3, ot_losses: 1, shootout_losses: 1, points: 12, goals_for: 30, goals_against: 25, pp_pct: 0.2, pk_pct: 0.8 }
    fetchWithRetry.mockImplementation(async () => ok([row]))
    const expected = { season: 3, gamesPlayed: 10, wins: 5, losses: 3, otLosses: 2, points: 12, goalsFor: 30, goalsAgainst: 25, ppPct: 0.2, pkPct: 0.8 }
    expect(await api.fetchTeamSeasonsCompare(2, [3])).toEqual([expected])
    expect(await api.fetchTeamSeasonsCompareTeams(2, 5, 3)).toEqual([{ team: 2, ...expected }])
    fetchWithRetry.mockImplementation(async () => ok({ skaters: [1], goalies: 'bad' }))
    expect(await api.fetchGameBox(6)).toEqual({ skaters: [1], goalies: [] })
  })
})

it('ahlApi.js/echlApi.js re-export the shared client under their old names', () => {
  expect(ahlApi.AHL_TEAM_CONFIG).toEqual({ abbr: 'HER', teamId: 319 })
  expect(ahlApi.AHL_TEAM_ID).toBe(319)
  expect(echlApi.ECHL_TEAM_ID).toBeNull()
  for (const [mod, P] of [[ahlApi, 'AHL'], [echlApi, 'ECHL']]) {
    const fetches = Object.keys(mod).filter(k => k.startsWith('fetch'))
    expect(fetches).toHaveLength(23)
    for (const name of fetches) expect(typeof mod[name], name).toBe('function')
    expect(fetches.every(n => n.startsWith(`fetch${P}`))).toBe(true)
  }
})
