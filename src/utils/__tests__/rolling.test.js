// src/utils/__tests__/rolling.test.js
// Tests for rolling window calculations used in the Trends tab.
// These are extracted/reimplemented from TeamView.jsx so they can be
// tested independently without a DOM environment.

import { describe, it, expect } from 'vitest'

// ── Helpers (mirrors TeamView.jsx logic) ─────────────────────

function rollingWinPct(gameLog, windowSize = 10) {
  return gameLog.map((g, i) => {
    const window = gameLog.slice(Math.max(0, i - windowSize + 1), i + 1)
    return Math.round((window.filter(x => x.won).length / window.length) * 100)
  })
}

function rollingAvg(gameLog, key, windowSize = 5) {
  return gameLog.map((g, i) => {
    const window = gameLog.slice(Math.max(0, i - windowSize + 1), i + 1)
    return parseFloat((window.reduce((s, x) => s + x[key], 0) / window.length).toFixed(1))
  })
}

function rollingScoreFirstRate(gameLogWithSF, windowSize = 10, minGames = 3) {
  return gameLogWithSF.map((g, i) => {
    const window = gameLogWithSF.slice(Math.max(0, i - windowSize + 1), i + 1)
    const withData = window.filter(x => x.scoredFirst != null)
    return withData.length >= minGames
      ? Math.round(withData.filter(x => x.scoredFirst).length / withData.length * 100)
      : null
  })
}

// ── Test data ─────────────────────────────────────────────────
function makeGame(won, carScore = won ? 3 : 1, oppScore = won ? 1 : 3, scoredFirst = null) {
  return { won, carScore, oppScore, scoredFirst }
}

// ── rollingWinPct ─────────────────────────────────────────────
describe('rollingWinPct', () => {
  it('returns 100% for all wins in first game', () => {
    const log = [makeGame(true)]
    const result = rollingWinPct(log, 10)
    expect(result[0]).toBe(100)
  })

  it('returns 0% for all losses in first game', () => {
    const log = [makeGame(false)]
    const result = rollingWinPct(log, 10)
    expect(result[0]).toBe(0)
  })

  it('correctly calculates 50% for 1W 1L', () => {
    const log = [makeGame(true), makeGame(false)]
    const result = rollingWinPct(log, 10)
    expect(result[1]).toBe(50)
  })

  it('uses a rolling window — old games fall off', () => {
    // 5 losses then 10 wins — at index 14, window should be all 10 wins = 100%
    const log = [
      ...Array(5).fill(makeGame(false)),
      ...Array(10).fill(makeGame(true)),
    ]
    const result = rollingWinPct(log, 10)
    expect(result[14]).toBe(100)  // last game: all 10 in window are wins
  })

  it('handles exact window size boundary', () => {
    // 10 games: 5 wins, 5 losses → 50%
    const log = [
      ...Array(5).fill(makeGame(true)),
      ...Array(5).fill(makeGame(false)),
    ]
    const result = rollingWinPct(log, 10)
    expect(result[9]).toBe(50)
  })

  it('returns one value per game', () => {
    const log = Array(20).fill(makeGame(true))
    const result = rollingWinPct(log, 10)
    expect(result).toHaveLength(20)
  })
})

// ── rollingAvg ────────────────────────────────────────────────
describe('rollingAvg (GF/GA)', () => {
  it('returns score for first game exactly', () => {
    const log = [makeGame(true, 4, 1)]
    const result = rollingAvg(log, 'carScore', 5)
    expect(result[0]).toBe(4.0)
  })

  it('averages correctly over multiple games', () => {
    const log = [
      makeGame(true,  4, 1),
      makeGame(true,  2, 1),
      makeGame(false, 1, 3),
    ]
    const result = rollingAvg(log, 'carScore', 5)
    // After 3 games: (4+2+1)/3 = 2.3
    expect(result[2]).toBe(2.3)
  })

  it('window rolls off old values after windowSize games', () => {
    // 5-game window: games are all 0 goals except last 5 which are all 4
    const log = [
      ...Array(5).fill(makeGame(false, 0, 3)),
      ...Array(5).fill(makeGame(true, 4, 1)),
    ]
    const result = rollingAvg(log, 'carScore', 5)
    // At index 9: window is [4,4,4,4,4] → avg = 4.0
    expect(result[9]).toBe(4.0)
  })
})

// ── rollingScoreFirstRate ─────────────────────────────────────
describe('rollingScoreFirstRate', () => {
  it('returns null when fewer than minGames have data', () => {
    const log = [
      makeGame(true, 3, 1, true),
      makeGame(true, 3, 1, false),
      // Only 2 games with data — below minGames=3
    ]
    const result = rollingScoreFirstRate(log, 10, 3)
    expect(result[1]).toBeNull()
  })

  it('returns a value once minGames threshold is met', () => {
    const log = [
      makeGame(true, 3, 1, true),
      makeGame(true, 3, 1, true),
      makeGame(true, 3, 1, false),
    ]
    const result = rollingScoreFirstRate(log, 10, 3)
    // 3 games with data: 2 scored first → 67%
    expect(result[2]).toBe(67)
  })

  it('skips null scoredFirst values', () => {
    const log = [
      makeGame(true, 3, 1, null),   // no data
      makeGame(true, 3, 1, null),   // no data
      makeGame(true, 3, 1, null),   // no data
      makeGame(true, 3, 1, true),
      makeGame(true, 3, 1, true),
      makeGame(true, 3, 1, true),
    ]
    const result = rollingScoreFirstRate(log, 10, 3)
    // At index 3, 4, 5: 3 games with data (all true) → 100%
    expect(result[5]).toBe(100)
  })

  it('returns 100% when all games scored first', () => {
    const log = Array(5).fill(makeGame(true, 3, 1, true))
    const result = rollingScoreFirstRate(log, 10, 3)
    expect(result[4]).toBe(100)
  })

  it('returns 0% when no games scored first', () => {
    const log = Array(5).fill(makeGame(false, 1, 3, false))
    const result = rollingScoreFirstRate(log, 10, 3)
    expect(result[4]).toBe(0)
  })
})

// ── streak calculation ────────────────────────────────────────
describe('streak calculation', () => {
  function calcStreak(gameLog) {
    let streak = 0, streakType = ''
    for (let i = gameLog.length - 1; i >= 0; i--) {
      const g = gameLog[i]
      if (i === gameLog.length - 1) {
        streakType = g.won ? 'W' : 'L'; streak = 1
      } else if ((g.won && streakType === 'W') || (!g.won && streakType === 'L')) {
        streak++
      } else {
        break
      }
    }
    return { streak, streakType }
  }

  it('detects a win streak', () => {
    const log = [makeGame(false), makeGame(true), makeGame(true), makeGame(true)]
    const { streak, streakType } = calcStreak(log)
    expect(streakType).toBe('W')
    expect(streak).toBe(3)
  })

  it('detects a loss streak', () => {
    const log = [makeGame(true), makeGame(false), makeGame(false)]
    const { streak, streakType } = calcStreak(log)
    expect(streakType).toBe('L')
    expect(streak).toBe(2)
  })

  it('streak of 1 for alternating results', () => {
    const log = [makeGame(true), makeGame(false), makeGame(true), makeGame(false)]
    const { streak, streakType } = calcStreak(log)
    expect(streak).toBe(1)
    expect(streakType).toBe('L')
  })

  it('handles single game log', () => {
    const { streak, streakType } = calcStreak([makeGame(true)])
    expect(streak).toBe(1)
    expect(streakType).toBe('W')
  })
})
