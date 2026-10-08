// src/hooks/__tests__/usePWHLSummaryFreshness.test.jsx
// A live PWHL game's /pwhl/summary is read again for each period, until the
// game is final (as useHockeyTechPeriodSummary does). It used to be kept for
// the session from the first period's read, so the second period's score
// and goal details came from an answer given before they happened.
//
// PWHL 233 (real, fixtures/pwhl-game-233): away 1-0 after the first, 2-1
// after the second. /pwhl/summary is answered as HockeyTech would mid-game:
// only the periods played so far.

import { describe, it, expect, vi, beforeAll, beforeEach, afterAll } from 'vitest'
import { renderHook, resetSessionStorage } from '../../utils/__tests__/testHelpers/renderHook.jsx'
import live from '../../utils/__tests__/fixtures/pwhl-game-233/live.json'
import summary from '../../utils/__tests__/fixtures/pwhl-game-233/summary.json'

let mod
const asOf = periods => ({ ...summary, periods: summary.periods.filter(p => p.info.id <= periods) })
const firstOf = period => live.events.findIndex(e => e.period === period)
const upTo = n => ({ ...live, gameStatus: 'live', events: live.events.slice(0, n) })

let answers
const fetchMock = vi.fn(async () => ({ ok: true, json: async () => answers.shift() ?? summary }))

beforeAll(async () => {
  vi.stubEnv('VITE_WORKER_URL', 'https://worker.test')
  vi.stubGlobal('fetch', fetchMock)
  mod = await import('../usePWHLPeriodSummary.js')
})
afterAll(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals() })
beforeEach(() => { resetSessionStorage(); fetchMock.mockClear(); mod.clearPWHLSummaryCache() })

describe('usePWHLPeriodSummary while live', () => {
  it('reads /pwhl/summary again for each period, revalidating', async () => {
    answers = [asOf(1), asOf(2)]
    const teamId = live.awayTeamId
    const h = renderHook(({ data }) => mod.usePWHLPeriodSummary({
      liveData: data, pbpData: null, isLive: true, gameId: live.gameId, teamId,
    }), { data: upTo(firstOf(2)) })
    h.rerender({ data: upTo(firstOf(2) + 1) })
    await h.flush()
    h.rerender({ data: upTo(firstOf(3) + 1) })
    await h.flush()

    const [p1, p2] = h.result.current.summaries
    expect(p1).toMatchObject({ period: 1, homeScore: 0, awayScore: 1 })
    // Through the second period, from the second read: 1-2, not 0-1.
    expect(p2).toMatchObject({ period: 2, homeScore: 1, awayScore: 2 })
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(fetchMock.mock.calls[0][1]).toEqual({ cache: 'no-cache' })
  })
})

describe('fetchHTSummary', () => {
  it('reads a final once, however many periods ask at once', async () => {
    answers = []
    const reads = await Promise.all([1, 2, 3].map(() => mod.fetchHTSummary(233, { final: true })))
    expect(reads.every(r => r?.periods?.length === 4)).toBe(true)
    await mod.fetchHTSummary(233)
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('reads a live game every time', async () => {
    answers = []
    await mod.fetchHTSummary(233, { final: false })
    await mod.fetchHTSummary(233, { final: false })
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('tries a failed final read again', async () => {
    fetchMock.mockResolvedValueOnce({ ok: false })
    expect(await mod.fetchHTSummary(233)).toBeNull()
    answers = []
    expect((await mod.fetchHTSummary(233))?.periods).toHaveLength(4)
  })
})
