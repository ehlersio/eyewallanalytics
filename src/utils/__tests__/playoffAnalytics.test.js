// src/utils/__tests__/playoffAnalytics.test.js
// Playoff analytics (game-type split, 2026-09): getPlayerAnalytics() and
// getGoalieAnalytics() map the Worker's poRows into `po` -- null when a
// player has no playoff analytics, so the Analytics tab never offers an
// empty "Playoffs" view -- and getTeamXgTrend() asks for one game type.

import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest'

const fetchWithRetry = vi.fn()
vi.mock('../retryFetch', () => ({ fetchWithRetry: (...a) => fetchWithRetry(...a) }))

let getPlayerAnalytics, getGoalieAnalytics, getTeamXgTrend
beforeAll(async () => {
  vi.stubEnv('VITE_WORKER_URL', 'https://worker.test')
  ;({ getPlayerAnalytics, getGoalieAnalytics, getTeamXgTrend } = await import('../supabaseClient'))
})

function respond(body) {
  fetchWithRetry.mockResolvedValue({ ok: true, json: async () => body })
}

beforeEach(() => fetchWithRetry.mockReset())

describe('getPlayerAnalytics', () => {
  it('maps playoff WAR, RAPM and minutes into po, and the regular RAPM', async () => {
    respond({
      rows: [
        { player_id: 1, war: 0.5, rapm: 0.05, rapm_toi_min: 3000, games_played: 82, ev_off_pct: 0.55 },
        { player_id: 2, war: 0.1, rapm: -0.01, rapm_toi_min: 900, games_played: 60 },
      ],
      poRows: [
        { player_id: 1, war: 0.109, rapm: 0.055, rapm_toi_min: 953, games_played: 19, game_score: 14.88, ev_off_pct: 0.561, hits: 20 },
        { player_id: 2, hits: 4 }, // box score only: no playoff analytics
      ],
    })
    const a = await getPlayerAnalytics(20252026)
    expect(a['1'].rapm).toBe(0.05)
    expect(a['1'].rapmToiMin).toBe(3000)
    expect(a['1'].po).toMatchObject({ war: 0.109, rapm: 0.055, rapmToiMin: 953, gp: 19, gameScore: 14.88, xGF_pct: 56.1 })
    expect(a['1'].poDef.hits).toBe(20)
    expect(a['2'].po).toBeNull()
    expect(a['2'].poDef.hits).toBe(4)
  })
})

describe('getGoalieAnalytics', () => {
  it('maps playoff GSAX and save % into po, null without playoff rows', async () => {
    respond({
      rows: [{ player_id: 31, gsax: 12.4, games_played: 50 }, { player_id: 35, gsax: 1.2 }],
      poRows: [{ player_id: 31, gsax: 4.99, gsax_per60: 1.328, games_played: 4, ev_sv_pct: 0.917, qs_pct: 0.75 }],
    })
    const g = await getGoalieAnalytics(20252026)
    expect(g['31'].po).toMatchObject({ gsax: 4.99, gsax60: 1.328, gp: 4, evSvPct: 91.7, qsPct: 0.75 })
    expect(g['35'].po).toBeNull()
  })
})

describe('getTeamXgTrend', () => {
  it('asks /xg-trend for the game type', async () => {
    respond([])
    await getTeamXgTrend('CAR', 20252026, 3)
    expect(fetchWithRetry.mock.calls.map(c => c[0])).toContain('https://worker.test/xg-trend?team=CAR&season=20252026&gameType=3')
  })
})
