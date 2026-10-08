// src/hooks/__tests__/useHockeyTechPeriodSummary.test.jsx
// AHL 1029081 (CLT at HER, 2026-10-03) replayed through the real hooks:
// a period's summary arrives when the next period's first event does (the
// feed has no period-end marker), the last one and the final once the
// game is over, and each team's are kept under its own key, so a guest
// view never writes over the followed team's.

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, resetSessionStorage } from '../../utils/__tests__/testHelpers/renderHook.jsx'
import { useHockeyTechPeriodSummary, useHockeyTechGameSummary, periodSummaryStorageKey, gameSummaryStorageKey } from '../useHockeyTechPeriodSummary.js'
import live from '../../utils/__tests__/fixtures/ahl-game-1029081/live.json'
import htSummary from '../../utils/__tests__/fixtures/ahl-game-1029081/summary.json'

const HER = 319, CLT = 384
const league = { key: 'ahl', headshotSize: '240x240', api: { fetchGameSummary: vi.fn(async () => htSummary) } }
const upTo = (period, status = 'live') => ({ ...live, gameStatus: status, events: live.events.filter(e => e.period <= period) })

const useBoth = ({ data, isLive, teamId }) => ({
  period: useHockeyTechPeriodSummary({ league, liveData: data, isLive, gameId: live.gameId, teamId }),
  game: useHockeyTechGameSummary({ league, liveData: data, gameId: live.gameId, teamId }),
})

beforeEach(() => resetSessionStorage())

describe('useHockeyTechPeriodSummary', () => {
  it('closes a period when the next one starts, and the rest at the final', async () => {
    const h = renderHook(useBoth, { data: upTo(1), isLive: true, teamId: HER })
    await h.flush()
    expect(h.result.current.period.summaries).toEqual([])

    h.rerender({ data: upTo(2), isLive: true, teamId: HER })
    await h.flush()
    expect(h.result.current.period.summaries.map(s => s.period)).toEqual([1])
    expect(h.result.current.period.newSummary).toMatchObject({ period: 1, carSOG: 12, oppSOG: 10 })
    expect(h.result.current.game.gameSummary).toBeNull()

    h.rerender({ data: upTo(3, 'final'), isLive: false, teamId: HER })
    await h.flush()
    expect(h.result.current.period.summaries.map(s => s.period)).toEqual([1, 2, 3])
    expect(h.result.current.game.gameSummary).toMatchObject({ period: 'game', carScore: 2, oppScore: 5 })
  })

  it('builds a final opened as one quietly, and keeps it per team', async () => {
    const h = renderHook(useBoth, { data: upTo(3, 'final'), isLive: false, teamId: HER })
    await h.flush()
    expect(h.result.current.period.summaries).toHaveLength(3)
    expect(h.result.current.period.newSummary).toBeNull()
    h.unmount()

    // The same game watched as Charlotte: its own summaries, its own keys.
    const guest = renderHook(useBoth, { data: upTo(3, 'final'), isLive: false, teamId: CLT })
    await guest.flush()
    expect(guest.result.current.game.gameSummary).toMatchObject({ carScore: 5, oppScore: 2 })
    const her = JSON.parse(sessionStorage.getItem(gameSummaryStorageKey('ahl', HER)))
    const clt = JSON.parse(sessionStorage.getItem(gameSummaryStorageKey('ahl', CLT)))
    expect(her.summary.carScore).toBe(2)
    expect(clt.summary.carScore).toBe(5)
    expect(sessionStorage.getItem(periodSummaryStorageKey('ahl', HER))).not.toBeNull()
  })

  it('stores a narrative with its summary', async () => {
    const h = renderHook(useBoth, { data: upTo(3, 'final'), isLive: false, teamId: HER })
    await h.flush()
    h.result.current.period.updateSummaryNarrative(2, 'The Bears outshot the Checkers.')
    h.result.current.game.updateGameNarrative(null)
    await h.flush()
    expect(h.result.current.period.summaries[1]).toMatchObject({ aiNarrative: 'The Bears outshot the Checkers.', aiLoading: false })
    expect(h.result.current.game.gameSummary).toMatchObject({ aiNarrative: null, aiLoading: false })
    const stored = JSON.parse(sessionStorage.getItem(periodSummaryStorageKey('ahl', HER)))
    expect(stored.summaries[1].aiNarrative).toBe('The Bears outshot the Checkers.')
  })
})
