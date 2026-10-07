// src/utils/__tests__/gameWatch.test.js
// watchGame(): which game the popup hooks are on and whether they saw it
// live. The hooks used to clear the "seen live" flag in a [gameId] effect
// that ran after the [isLive] one, so it was always cleared once the
// game's data arrived and the win popup never fired (audit 2026-10-06 §14).

import { describe, it, expect } from 'vitest'
import { NO_GAME, watchGame, isHockeyTechFinal } from '../gameWatch.js'

function run(steps) {
  return steps.reduce((w, [gameId, isLive]) => watchGame(w, gameId, isLive), NO_GAME)
}

describe('watchGame', () => {
  it('a game whose data arrives with or after isLive is seen live', () => {
    expect(run([[null, true], ['1', true]])).toEqual({ gameId: '1', wasLive: true })
    expect(run([['1', true]])).toEqual({ gameId: '1', wasLive: true })
  })

  it('stays seen live after isLive turns false (the final snapshot)', () => {
    expect(run([['1', true], ['1', false]])).toEqual({ gameId: '1', wasLive: true })
  })

  it('a render without data is not a change of game', () => {
    expect(run([['1', true], [null, false], ['1', false]])).toEqual({ gameId: '1', wasLive: true })
  })

  it('a game opened after it ended was never seen live', () => {
    expect(run([['1', false]])).toEqual({ gameId: '1', wasLive: false })
  })

  it('a different game starts over', () => {
    expect(run([['1', true], ['1', false], ['2', false]])).toEqual({ gameId: '2', wasLive: false })
    expect(run([['1', true], ['2', true]])).toEqual({ gameId: '2', wasLive: true })
  })

  it('returns the same object when nothing changed, a new one when the game did', () => {
    const w = run([['1', true]])
    expect(watchGame(w, '1', true)).toBe(w)
    expect(watchGame(w, '1', false)).toBe(w)
    expect(watchGame(w, null, false)).toBe(w)
    expect(watchGame(w, '2', true)).not.toBe(w)
  })
})

describe('isHockeyTechFinal', () => {
  it('reads the /live payload status', () => {
    expect(isHockeyTechFinal({ gameStatus: 'final' })).toBe(true)
    expect(isHockeyTechFinal({ gameStatus: 'live' })).toBe(false)
    expect(isHockeyTechFinal({ gameStatus: 'pre' })).toBe(false)
    expect(isHockeyTechFinal(null)).toBe(false)
  })
})
