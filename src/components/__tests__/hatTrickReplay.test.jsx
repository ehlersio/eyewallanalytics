// src/components/__tests__/hatTrickReplay.test.jsx
// The hat-trick count is per game. NHL useGameEvents and PWHL
// usePWHLGameEvents kept goals-per-scorer for the life of the page, so a
// player's goals carried into the next game watched: two one night and one
// the next popped up as a hat trick. Real consecutive games replayed live
// through the real hooks, one play at a time:
//   NHL, CAR: 2025030132 (Logan Stankoven 1 goal), then 2026010044 (Stankoven 2).
//   PWHL, NY: 212 (Taylor Girard's real hat trick), 243 (Kristýna Kaltounková
//   1 goal), then 248 (Kaltounková 2).

import { describe, it, expect, beforeEach } from 'vitest'
import { renderHook, resetSessionStorage } from '../../utils/__tests__/testHelpers/renderHook.jsx'
import { useGameEvents, nhlGoalsByScorer } from '../GameEvents.jsx'
import { usePWHLGameEvents, pwhlGoalsByScorer } from '../PWHLGameEvents.jsx'
import nhlA from '../../utils/__tests__/fixtures/nhl-games/2025030132.json'
import nhlB from '../../utils/__tests__/fixtures/nhl-games/2026010044.json'
import pwhl212 from '../../utils/__tests__/fixtures/pwhl-game-212/live.json'
import pwhl243 from '../../utils/__tests__/fixtures/pwhl-game-243/live.json'
import pwhl248 from '../../utils/__tests__/fixtures/pwhl-game-248/live.json'

beforeEach(() => resetSessionStorage())

// Every distinct popup the hook produced, in order.
function log(h, key) {
  const seen = []
  return { record() { const p = h.result.current[key]; if (p && p !== seen.at(-1)) seen.push(p) }, seen }
}

describe('NHL hat trick (useGameEvents)', () => {
  const CAR = 12
  const STANKOVEN = '8482702'
  const useCar = ({ pbp, isLive }) => useGameEvents(pbp, isLive, {}, true, CAR, 'CAR', '#c00')

  it('counts each game’s goals on their own', () => {
    expect(nhlGoalsByScorer(nhlA.pbp.plays, CAR).counts[STANKOVEN]).toBe(1)
    expect(nhlGoalsByScorer(nhlB.pbp.plays, CAR).counts[STANKOVEN]).toBe(2)
  })

  it('does not carry a scorer’s goals into the next game', () => {
    const h = renderHook(useCar, { pbp: null, isLive: false })
    const hatTricks = log(h, 'hatTrickPopup')
    const goals = log(h, 'goalPopup')
    for (const game of [nhlA.pbp, nhlB.pbp]) {
      for (let k = 1; k <= game.plays.length; k++) {
        h.rerender({ pbp: { ...game, plays: game.plays.slice(0, k) }, isLive: true })
        hatTricks.record(); goals.record()
      }
    }
    expect(hatTricks.seen).toHaveLength(0)
    // Every CAR goal after each game's first play popped up as a goal --
    // game B's eventIds aren't hidden by game A's.
    const carGoals = g => g.plays.filter(p => p.typeDescKey === 'goal' && p.details.eventOwnerTeamId === CAR).length
    expect(goals.seen).toHaveLength(carGoals(nhlA.pbp) + carGoals(nhlB.pbp))
  })
})

describe('PWHL hat trick (usePWHLGameEvents)', () => {
  const NY = 4
  const useNy = ({ data, isLive }) => usePWHLGameEvents(data, isLive, NY, 'NY')
  const replay = (h, game, logs, from = 1) => {
    for (let k = from; k <= game.events.length; k++) {
      h.rerender({ data: { ...game, gameStatus: 'live', events: game.events.slice(0, k) }, isLive: true })
      logs.forEach(l => l.record())
    }
  }

  it('counts each game’s goals on their own', () => {
    expect(pwhlGoalsByScorer(pwhl212.events, NY)).toMatchObject({ 9: 3 })
    expect(pwhlGoalsByScorer(pwhl243.events, NY)['245']).toBe(1)
    expect(pwhlGoalsByScorer(pwhl248.events, NY)['245']).toBe(2)
  })

  it('pops up the real hat trick, and none for goals carried from the last game', () => {
    const h = renderHook(useNy, { data: null, isLive: false })
    const hatTricks = log(h, 'hatTrickPopup')
    for (const game of [pwhl212, pwhl243, pwhl248]) replay(h, game, [hatTricks])
    expect(hatTricks.seen).toHaveLength(1)
    expect(hatTricks.seen[0].scorer).toMatch(/Girard/)
  })

  it('counts the goals scored before the game was opened', () => {
    // Opened after Girard's second goal: the third is still her hat trick.
    const second = pwhl212.events.filter(e => e.eventType === 'goal' && e.scoredBy?.id === 9)[1]
    const from = pwhl212.events.indexOf(second) + 1
    const h = renderHook(useNy, { data: { ...pwhl212, gameStatus: 'live', events: pwhl212.events.slice(0, from) }, isLive: true })
    const hatTricks = log(h, 'hatTrickPopup')
    replay(h, pwhl212, [hatTricks], from + 1)
    expect(hatTricks.seen).toHaveLength(1)
  })
})
