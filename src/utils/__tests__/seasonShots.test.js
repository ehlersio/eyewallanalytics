// src/utils/__tests__/seasonShots.test.js
// getSeasonShots() feeds the shot map's "All N" season view. Its dots said
// "Shot by: Unknown" until the Worker named each row's shooter and goalie
// (eyewall-poller#167), then assists and blocker (#168); this keeps those
// names on the way through.

import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest'

const fetchWithRetry = vi.fn()
vi.mock('../retryFetch', () => ({ fetchWithRetry: (...a) => fetchWithRetry(...a) }))

let getSeasonShots
beforeAll(async () => {
  vi.stubEnv('VITE_WORKER_URL', 'https://worker.test')
  ;({ getSeasonShots } = await import('../supabaseClient'))
})

beforeEach(() => fetchWithRetry.mockReset())

const row = {
  game_id: 2026020001, event_id: 190, team: 'FLA', x: 81, y: 6, event_type: 'missed-shot',
  period: 1, time_in_period: '08:56', shot_type: 'tip-in',
  player_id: 8479314, goalie_id: 8483548, shooter_name: 'Matthew Tkachuk', goalie_name: 'Brandon Bussi',
}

describe('getSeasonShots', () => {
  it('carries the shooter and goalie through', async () => {
    fetchWithRetry.mockResolvedValue({ ok: true, json: async () => [row] })
    const [shot] = await getSeasonShots('CAR', 20262027)
    expect(fetchWithRetry.mock.calls[0][0]).toBe('https://worker.test/nhl/shots?team=CAR&season=20262027')
    expect(shot).toMatchObject({
      gameId: 2026020001, eventId: 190, type: 'missed-shot', isCanes: false,
      shooterId: 8479314, shooterName: 'Matthew Tkachuk', goalieName: 'Brandon Bussi',
    })
  })

  it('carries a goal\'s assists and a blocked shot\'s blocker through', async () => {
    fetchWithRetry.mockResolvedValue({ ok: true, json: async () => [
      { ...row, event_type: 'goal', assist1_name: 'Aleksander Barkov', assist2_name: 'Sam Reinhart' },
      { ...row, event_type: 'blocked-shot', blocker_name: 'Sebastian Aho' },
    ] })
    const [goal, block] = await getSeasonShots('CAR', 20262027)
    expect(goal).toMatchObject({ assist1Name: 'Aleksander Barkov', assist2Name: 'Sam Reinhart', blockerName: null })
    expect(block).toMatchObject({ blockerName: 'Sebastian Aho', assist1Name: null, assist2Name: null })
  })

  it('leaves a name the Worker does not have as null', async () => {
    fetchWithRetry.mockResolvedValue({ ok: true, json: async () => [{ ...row, shooter_name: null, goalie_name: undefined }] })
    const [shot] = await getSeasonShots('CAR', 20262027)
    expect(shot.shooterName).toBeNull()
    expect(shot.goalieName).toBeNull()
  })
})
