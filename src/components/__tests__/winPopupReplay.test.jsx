// src/components/__tests__/winPopupReplay.test.jsx
// The win popup, replayed through the real game-event hooks with real
// completed games: each game's final payload is cut into live snapshots
// (events so far, running score) and fed the way the shot maps feed them,
// then the game ends the way it does in production -- /today (or the NHL
// schedule) stops saying live, the view stops passing live data, and
// useEndedGameSnapshot fetches the final state.
//
// Before the fix the popup never fired in any league: the hooks cleared
// their "seen live" flag in a [gameId] effect that ran after the [isLive]
// one, and the AHL/ECHL/PWHL views passed null once the game was final
// (audit 2026-10-06 §14). It must fire exactly once, and only for a win
// watched live.
//
// Fixtures (Worker answers, saved 2026-10-07): AHL 1028925 (home 335 wins
// 4-2), ECHL 24296 (home 99 wins 6-5 in OT), PWHL 233 (away 5 wins 3-2 in
// OT, fixtures/pwhl-game-233), NHL 2025030132 (CAR wins 3-2 in 2OT at
// home, playoffs) and 2025020121 (an older CAR game the page falls back
// to), fixtures/nhl-games.

import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../../utils/seasonClient', () => ({
  fetchSeasonsConfig: vi.fn(() => Promise.reject(new Error('offline in tests'))),
  fetchComparisonSeasons: vi.fn(() => Promise.reject(new Error('offline in tests'))),
}))

import { renderHook, resetSessionStorage } from '../../utils/__tests__/testHelpers/renderHook.jsx'
import '../../i18n/index.js'
import { useHockeyTechGameEvents } from '../hockeytech/HockeyTechGameEvents.jsx'
import { usePWHLGameEvents } from '../PWHLGameEvents.jsx'
import { useGameEvents } from '../GameEvents.jsx'
import { useEndedGameSnapshot } from '../../hooks/useEndedGameSnapshot.js'
import { isHockeyTechFinal } from '../../utils/gameWatch.js'
import { isCompleted } from '../../utils/nhlApi.js'
import { AHL, ECHL } from '../../utils/hockeyTechLeagues.js'
import ahlFinal from '../../utils/__tests__/fixtures/game-events-replay/ahl-1028925-live.json'
import echlFinal from '../../utils/__tests__/fixtures/game-events-replay/echl-24296-live.json'
import pwhlFinal from '../../utils/__tests__/fixtures/pwhl-game-233/live.json'
import pwhlShootout from '../../utils/__tests__/fixtures/pwhl-game-326/live.json'
import nhlGame from '../../utils/__tests__/fixtures/nhl-games/2025030132.json'
import nhlOlderGame from '../../utils/__tests__/fixtures/nhl-games/2025020121.json'

beforeEach(() => resetSessionStorage())

// HockeyTech /live payloads (AHL, ECHL, PWHL) as they looked during the
// game: every `step` events, status live, score from the goals so far.
// `upTo` leaves the last events out of every live snapshot.
function liveSnapshots(final, { step = 7, upTo = final.events.length } = {}) {
  const out = []
  for (let k = 1; k <= upTo; k += step) {
    const events = final.events.slice(0, k)
    const goals = events.filter(e => e.eventType === 'goal')
    out.push({
      ...final, events, gameStatus: 'live',
      homeScore: goals.filter(g => g.teamId === final.homeTeamId).length,
      awayScore: goals.filter(g => g.teamId === final.awayTeamId).length,
    })
  }
  return out
}

// Every distinct popup object the hook produced, in order.
function popupLog(h, key) {
  const seen = []
  return {
    record() {
      const p = h.result.current[key]
      if (p && p !== seen[seen.length - 1]) seen.push(p)
    },
    seen,
  }
}

// A shot map's wiring: live data while /today says live, then the ended
// game's final snapshot from useEndedGameSnapshot.
function hockeyTechView(useEvents, fetchLive) {
  return ({ isLive, liveGameId, liveData }) => {
    const ended = useEndedGameSnapshot(isLive ? liveGameId : null, isLive, liveData, fetchLive, isHockeyTechFinal)
    return useEvents(isLive ? liveData : ended, isLive)
  }
}

// Plays a HockeyTech game: not live, live with no data yet, the live
// snapshots, then final (the view drops the live data; the snapshot fetch
// answers `finalAnswer`). Returns the hook handle and the popup logs.
async function playHockeyTechGame(useEvents, final, { finalAnswer = final, liveUpTo } = {}) {
  const fetchLive = vi.fn(async () => finalAnswer)
  const h = renderHook(hockeyTechView(useEvents, fetchLive), { isLive: false, liveGameId: null, liveData: null })
  const wins = popupLog(h, 'winPopup')
  const goals = popupLog(h, 'goalPopup')
  const step = props => { h.rerender(props); wins.record(); goals.record() }
  step({ isLive: true, liveGameId: final.gameId, liveData: null })
  for (const s of liveSnapshots(final, { upTo: liveUpTo })) step({ isLive: true, liveGameId: final.gameId, liveData: s })
  step({ isLive: false, liveGameId: null, liveData: null })
  await h.flush(); wins.record(); goals.record()
  return { h, wins, goals, fetchLive, step }
}

describe('AHL/ECHL win popup (useHockeyTechGameEvents)', () => {
  const useAhlHome = (data, isLive) => useHockeyTechGameEvents(AHL, data, isLive, ahlFinal.homeTeamId, 'HOM')

  it('fires once when the followed team wins a game watched live', async () => {
    const { h, wins, fetchLive, step } = await playHockeyTechGame(useAhlHome, ahlFinal)
    expect(fetchLive).toHaveBeenCalledWith(ahlFinal.gameId)
    expect(wins.seen).toHaveLength(1)
    expect(wins.seen[0].score).toMatch(/^HOM 4 – \S+ 2$/)

    // More renders and another final answer don't fire it again.
    step({ isLive: false, liveGameId: null, liveData: null })
    await h.flush(); wins.record()
    expect(wins.seen).toHaveLength(1)
  })

  it('fires once when /live says final while /today still says live', async () => {
    const h = renderHook(hockeyTechView(useAhlHome, async () => ahlFinal), { isLive: true, liveGameId: ahlFinal.gameId, liveData: null })
    const wins = popupLog(h, 'winPopup')
    for (const s of liveSnapshots(ahlFinal)) { h.rerender({ isLive: true, liveGameId: ahlFinal.gameId, liveData: s }); wins.record() }
    h.rerender({ isLive: true, liveGameId: ahlFinal.gameId, liveData: ahlFinal }); wins.record()
    expect(wins.seen).toHaveLength(1)
    h.rerender({ isLive: false, liveGameId: null, liveData: null })
    await h.flush(); wins.record()
    expect(wins.seen).toHaveLength(1)
  })

  it('fires for an OT win, with the OT goal, when only the final snapshot has it', async () => {
    const useEchlHome = (data, isLive) => useHockeyTechGameEvents(ECHL, data, isLive, echlFinal.homeTeamId, 'HOM')
    const otGoal = echlFinal.events.findLastIndex(e => e.eventType === 'goal')
    expect(echlFinal.events[otGoal].period).toBe(4)
    const { wins, goals } = await playHockeyTechGame(useEchlHome, echlFinal, { liveUpTo: otGoal })
    expect(wins.seen).toHaveLength(1)
    expect(wins.seen[0].score).toMatch(/^HOM 6 – \S+ 5$/)
    expect(goals.seen.at(-1).periodLabel).toBe('OT')
  })

  it('keeps polling until /live says final', async () => {
    vi.useFakeTimers()
    try {
      const answers = [liveSnapshots(ahlFinal).at(-1), ahlFinal]
      const fetchLive = vi.fn(async () => answers.shift() ?? ahlFinal)
      const h = renderHook(hockeyTechView(useAhlHome, fetchLive), { isLive: true, liveGameId: ahlFinal.gameId, liveData: liveSnapshots(ahlFinal)[0] })
      h.rerender({ isLive: false, liveGameId: null, liveData: null })
      await h.flush()
      expect(h.result.current.winPopup).toBeNull()
      await vi.advanceTimersByTimeAsync(30_000)
      await h.flush()
      expect(h.result.current.winPopup).not.toBeNull()
      expect(fetchLive).toHaveBeenCalledTimes(2)
      await vi.advanceTimersByTimeAsync(120_000)
      expect(fetchLive).toHaveBeenCalledTimes(2)
    } finally {
      vi.useRealTimers()
    }
  })

  it('does not fire for a loss', async () => {
    const useAhlAway = (data, isLive) => useHockeyTechGameEvents(AHL, data, isLive, ahlFinal.awayTeamId, 'AWY')
    const { wins } = await playHockeyTechGame(useAhlAway, ahlFinal)
    expect(wins.seen).toHaveLength(0)
  })

  it('does not fire for a game opened after it ended', () => {
    const h = renderHook(({ data }) => useAhlHome(data, false), { data: null })
    h.rerender({ data: ahlFinal })
    expect(h.result.current.winPopup).toBeNull()
  })
})

describe('PWHL win popup (usePWHLGameEvents)', () => {
  const usePwhlAway = (data, isLive) => usePWHLGameEvents(data, isLive, pwhlFinal.awayTeamId, 'AWY')

  it('fires once for an OT win watched live', async () => {
    const otGoal = pwhlFinal.events.findLastIndex(e => e.eventType === 'goal')
    expect(pwhlFinal.events[otGoal].period).toBe(4)
    const { wins, goals } = await playHockeyTechGame(usePwhlAway, pwhlFinal, { liveUpTo: otGoal })
    expect(wins.seen).toHaveLength(1)
    expect(wins.seen[0].score).toMatch(/^AWY 3 – \S+ 2$/)
    expect(goals.seen.at(-1).periodLabel).toBe('OT')
  })

  // PWHL 326: MTL wins 2-1 at SEA in a shootout. /pwhl/live has sent the
  // shootout attempts (period 7) and the official final score since the
  // Worker's W13; no goal event carries the deciding shootout goal.
  it('fires once for a shootout win watched live, from the final score', async () => {
    const usePwhlMtl = (data, isLive) => usePWHLGameEvents(data, isLive, pwhlShootout.awayTeamId, 'MTL')
    const { wins, goals } = await playHockeyTechGame(usePwhlMtl, pwhlShootout)
    expect(wins.seen).toHaveLength(1)
    expect(wins.seen[0].score).toBe('MTL 2 – SEA 1')
    expect(goals.seen.map(g => g.periodLabel)).not.toContain('OT4')
  })

  it('does not fire for the losing side', async () => {
    const usePwhlHome = (data, isLive) => usePWHLGameEvents(data, isLive, pwhlFinal.homeTeamId, 'HOM')
    const { wins } = await playHockeyTechGame(usePwhlHome, pwhlFinal)
    expect(wins.seen).toHaveLength(0)
  })
})

describe('NHL win popup (useGameEvents)', () => {
  const final = nhlGame.pbp
  const older = nhlOlderGame.pbp
  const CAR = final.homeTeam.id

  // NHL play-by-play during the game: plays so far, LIVE, running score.
  function nhlLiveSnapshots(upTo, step = 15) {
    const out = []
    for (let k = 1; k <= upTo; k += step) {
      const plays = final.plays.slice(0, k)
      const goals = plays.filter(p => p.typeDescKey === 'goal')
      const by = id => goals.filter(g => g.details.eventOwnerTeamId === id).length
      out.push({
        ...final, plays, gameState: 'LIVE',
        periodDescriptor: plays.at(-1).periodDescriptor,
        homeTeam: { ...final.homeTeam, score: by(final.homeTeam.id) },
        awayTeam: { ...final.awayTeam, score: by(final.awayTeam.id) },
      })
    }
    return out
  }

  // ShotMapView's wiring: the live pbp while live; afterwards the page's
  // own pbp is another game, and the popups get the ended game's snapshot.
  function nhlView(fetchPbp) {
    return ({ isLive, liveGameId, pbp }) => {
      const ended = useEndedGameSnapshot(isLive ? liveGameId : null, isLive, pbp, fetchPbp, isCompleted)
      const eventsPbp = ended ?? pbp
      return useGameEvents(eventsPbp, isLive, {}, eventsPbp?.homeTeam?.id === CAR, CAR, 'CAR', '#c00')
    }
  }

  it('fires once for a 2OT win watched live, after the page moves to an older game', async () => {
    const winner = final.plays.findLastIndex(p => p.typeDescKey === 'goal')
    const fetchPbp = vi.fn(async () => final)
    const h = renderHook(nhlView(fetchPbp), { isLive: false, liveGameId: null, pbp: older })
    const wins = popupLog(h, 'winPopup')
    const goals = popupLog(h, 'goalPopup')
    h.rerender({ isLive: true, liveGameId: final.id, pbp: older })
    for (const s of nhlLiveSnapshots(winner)) { h.rerender({ isLive: true, liveGameId: final.id, pbp: s }); wins.record(); goals.record() }
    h.rerender({ isLive: false, liveGameId: null, pbp: older }); wins.record()
    await h.flush(); wins.record(); goals.record()
    expect(fetchPbp).toHaveBeenCalledWith(final.id)
    expect(wins.seen).toHaveLength(1)
    expect(wins.seen[0].score).toMatch(/^CAR 3 – \S+ 2$/)
    expect(goals.seen.at(-1).period).toBe('2OT')
  })

  it('does not fire for a finished game opened later', () => {
    const h = renderHook(({ pbp }) => useGameEvents(pbp, false, {}, true, CAR, 'CAR', '#c00'), { pbp: null })
    h.rerender({ pbp: final })
    expect(h.result.current.winPopup).toBeNull()
  })
})
