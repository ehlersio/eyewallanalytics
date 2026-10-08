// src/hooks/__tests__/usePWHLShootout.test.jsx
// PWHL 326 (MTL 2 at SEA 1, SO, 2025-26) as /pwhl/live answers it since
// the Worker's W13 (2026-10-08): its 12 shootout attempts arrive as
// 'shootout' events in period 7, after overtime (period 4). They aren't a
// period: the summaries stop at OT, the score card says "SO", not "OT4".
// Also: a guest game view's summaries live under their own keys.

import { describe, it, expect, beforeEach, beforeAll, afterAll, vi } from 'vitest'
import { renderHook, resetSessionStorage } from '../../utils/__tests__/testHelpers/renderHook.jsx'
import {
  usePWHLPeriodSummary, buildPWHLGameSummary, buildPWHLSummary, pwhlPlayedPeriods,
  pwhlPeriodSummaryKey, pwhlGameSummaryKey,
} from '../usePWHLPeriodSummary.js'
import { pwhlLiveClock } from '../../utils/pwhlShotMapStats.js'
import live from '../../utils/__tests__/fixtures/pwhl-game-326/live.json'

const SEA = 8, MTL = 3
const upTo = (n, status = 'live') => ({ ...live, gameStatus: status, events: live.events.slice(0, n) })
const firstOf = period => live.events.findIndex(e => e.period === period)

// The hook reads VITE_WORKER_URL at import. With a .env that sets it (every
// developer checkout), it would try the real Worker for narratives and the
// game summary and the summaries would never settle; CI and fresh worktrees
// have no .env, which hid this. Answer every fetch with a fast 404 so the
// test is the same everywhere.
const fetchMock = vi.fn(async () => ({ ok: false, status: 404, json: async () => null, text: async () => '' }))
beforeAll(() => vi.stubGlobal('fetch', fetchMock))
afterAll(() => vi.unstubAllGlobals())
beforeEach(() => { resetSessionStorage(); fetchMock.mockClear() })

describe('PWHL 326 shootout, as /pwhl/live sends it', () => {
  it('is a real shootout payload: 12 attempts in period 7, final 1-2', () => {
    expect(live.events.filter(e => e.eventType === 'shootout')).toHaveLength(12)
    expect(live.events.filter(e => e.eventType === 'shootout').every(e => e.period === 7)).toBe(true)
    expect(live).toMatchObject({ homeTeamId: SEA, awayTeamId: MTL, homeScore: 1, awayScore: 2, gameStatus: 'final' })
  })

  it('plays four periods, the shootout not one of them', () => {
    expect(pwhlPlayedPeriods(live.events)).toEqual([1, 2, 3, 4])
  })

  it('the score card reads SO with no clock during the shootout', () => {
    expect(pwhlLiveClock(live.events)).toEqual({ period: 7, time: null })
    const ot = live.events.slice(0, firstOf(7))
    expect(pwhlLiveClock(ot)).toMatchObject({ period: 4 })
    expect(pwhlLiveClock([])).toBeNull()
  })

  it('the game summary breaks down four periods, and a period-7 label would be SO', () => {
    const game = buildPWHLGameSummary(live.events, MTL, null, live.gameId)
    expect(game.periodStats.map(p => p.period)).toEqual([1, 2, 3, 4])
    expect(game.carGoals).toBe(1)
    expect(buildPWHLSummary(7, live.events, MTL, null, live.gameId)).toMatchObject({ periodLabel: 'SO', periodShort: 'SO' })
    expect(buildPWHLSummary(4, live.events, MTL, null, live.gameId)).toMatchObject({ periodShort: 'OT' })
  })
})

describe('usePWHLPeriodSummary on PWHL 326 watched live', () => {
  const useSummary = ({ data, guestTeamId = null, teamId = MTL }) => usePWHLPeriodSummary({
    liveData: data, pbpData: null, isLive: true, gameId: live.gameId, teamId, isPlayoff: false, guestTeamId,
  })

  it('closes overtime when the shootout starts, and never makes a shootout period', async () => {
    const h = renderHook(useSummary, { data: upTo(firstOf(2)) })
    for (const p of [2, 3, 4, 7]) {
      h.rerender({ data: upTo(firstOf(p) + 1) })
      await h.flush()
    }
    expect(h.result.current.summaries.map(s => s.period)).toEqual([1, 2, 3, 4])
    expect(h.result.current.newSummary).toMatchObject({ period: 4, periodShort: 'OT' })

    // Every attempt, then an intermission status mid-shootout: still no SO period.
    h.rerender({ data: upTo(live.events.length) })
    h.rerender({ data: { ...upTo(live.events.length), gameStatus: 'intermission' } })
    await h.flush()
    expect(h.result.current.summaries.map(s => s.period)).toEqual([1, 2, 3, 4])
  })

  it('keeps a guest view’s summaries under the guest’s own key', async () => {
    const h = renderHook(useSummary, { data: upTo(firstOf(2)), teamId: SEA, guestTeamId: SEA })
    h.rerender({ data: upTo(firstOf(2) + 1), teamId: SEA, guestTeamId: SEA })
    h.rerender({ data: upTo(firstOf(3) + 1), teamId: SEA, guestTeamId: SEA })
    await h.flush()
    expect(h.result.current.summaries.map(s => s.period)).toEqual([1, 2])
    expect(sessionStorage.getItem(pwhlPeriodSummaryKey())).toBeNull()
    expect(JSON.parse(sessionStorage.getItem(pwhlPeriodSummaryKey(SEA))).gameId).toBe('326')
  })

  it('names the keys: the followed team’s unchanged, a guest’s per team', () => {
    expect(pwhlPeriodSummaryKey()).toBe('eyewall_pwhl_period_summaries')
    expect(pwhlGameSummaryKey()).toBe('eyewall_pwhl_game_summary')
    expect(pwhlPeriodSummaryKey(8)).toBe('eyewall_pwhl_period_summaries:guest:8')
    expect(pwhlGameSummaryKey(8)).toBe('eyewall_pwhl_game_summary:guest:8')
  })
})
