// src/utils/__tests__/gameLogInsights.test.js
// getGameLogInsights() -- the live insights' situational records -- counts
// only games of the game on screen's type. On 2026-27's opening night it
// read "CAR is 1-1 vs FLA this season (2 games)" from two preseason games.

import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest'

const fetchWithRetry = vi.fn()
vi.mock('../retryFetch', () => ({ fetchWithRetry: (...a) => fetchWithRetry(...a) }))

let getGameLogInsights
beforeAll(async () => {
  vi.stubEnv('VITE_WORKER_URL', 'https://worker.test')
  ;({ getGameLogInsights } = await import('../supabaseClient'))
})

const game = (game_id, game_type, opponent, team_score, opp_score, team_scored_first) =>
  ({ game_id, game_type, opponent, team_score, opp_score, team_scored_first })

const ROWS = [
  game(2026010003, 1, 'FLA', 4, 2, true),   // preseason: never counts
  game(2026010007, 1, 'FLA', 1, 3, false),
  game(2026020001, 2, 'FLA', 3, 2, true),
  game(2026020009, 2, 'TBL', 2, 5, false),
  game(2026030111, 3, 'FLA', 1, 2, true),
]

beforeEach(() => {
  fetchWithRetry.mockReset()
  fetchWithRetry.mockResolvedValue({ ok: true, json: async () => ROWS })
})

describe('getGameLogInsights', () => {
  it('counts only regular-season games for a regular-season game', async () => {
    const gl = await getGameLogInsights('FLA', 20262027, 'CAR', 2)
    expect(gl.gameType).toBe(2)
    expect(gl.vsOppRecord).toEqual({ w: 1, l: 0, gp: 1 })
    expect(gl.total).toBe(2)
    expect(gl.scoredFirstGames).toBe(1)
  })

  it('counts only playoff games for a playoff game', async () => {
    const gl = await getGameLogInsights('FLA', 20262027, 'CAR', 3)
    expect(gl.vsOppRecord).toEqual({ w: 0, l: 1, gp: 1 })
    expect(gl.total).toBe(1)
  })

  it('has nothing for a preseason game, without a request', async () => {
    expect(await getGameLogInsights('FLA', 20262027, 'CAR', 1)).toBeNull()
    expect(fetchWithRetry).not.toHaveBeenCalled()
  })

  it('asks for the season of the game on screen', async () => {
    await getGameLogInsights('FLA', 20252026, 'CAR', 2)
    expect(fetchWithRetry.mock.calls[0][0]).toBe('https://worker.test/game-log?team=CAR&season=20252026')
  })
})
