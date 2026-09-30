// src/utils/__tests__/linesByGameType.test.js
// Lines and PP/PK units are per game type (eyewall-pipeline's game-type
// split, step 4): regular season and playoffs are built separately, never
// from preseason. getTeamLines()/getSpecialTeamsUnits() ask the Worker for
// one game type, and a carried-over unit keeps its source.

import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest'

const fetchWithRetry = vi.fn()
vi.mock('../retryFetch', () => ({ fetchWithRetry: (...a) => fetchWithRetry(...a) }))

let getTeamLines, getSpecialTeamsUnits
beforeAll(async () => {
  vi.stubEnv('VITE_WORKER_URL', 'https://worker.test')
  ;({ getTeamLines, getSpecialTeamsUnits } = await import('../supabaseClient'))
})

function respond(body) {
  fetchWithRetry.mockResolvedValue({ ok: true, json: async () => body })
}

const row = (unit_type, rank, source) => ({
  unit_type, rank, source,
  name_a: `A${rank}`, name_b: `B${rank}`, name_c: unit_type === 'F' ? `C${rank}` : null,
  pos_a: 'L', pos_b: 'C', pos_c: 'R', toi_secs: 600, xgf_pct: 0.55,
})

beforeEach(() => fetchWithRetry.mockReset())

describe('getTeamLines', () => {
  it('asks for the game type and keeps each unit\'s source', async () => {
    respond([
      row('F', 1, 'current'), row('F', 2, 'current'), row('F', 3, 'current'),
      row('F', 4, 'regular_season'), row('D', 1, 'current'),
    ])
    const lines = await getTeamLines('BOS', 20252026, 3)
    expect(fetchWithRetry.mock.calls[0][0]).toBe('https://worker.test/team-lines?team=BOS&season=20252026&gameType=3')
    expect(lines.lines.map(l => l.source)).toEqual(['current', 'current', 'current', 'regular_season'])
    expect(lines.pairs[0].source).toBe('current')
  })
})

describe('getSpecialTeamsUnits', () => {
  it('asks for the regular season by default and playoffs when asked', async () => {
    respond({ CAR: { PP: { 1: [1] }, PK: {} } })
    await getSpecialTeamsUnits(20252026)
    await getSpecialTeamsUnits(20252026, 3)
    expect(fetchWithRetry.mock.calls.map(c => c[0])).toEqual([
      'https://worker.test/special-teams?gameType=2&season=20252026',
      'https://worker.test/special-teams?gameType=3&season=20252026',
    ])
  })

  it('has no units for preseason, without a request', async () => {
    expect(await getSpecialTeamsUnits(20262027, null)).toEqual({})
    expect(fetchWithRetry).not.toHaveBeenCalled()
  })
})
