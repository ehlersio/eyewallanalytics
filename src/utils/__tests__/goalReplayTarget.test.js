// src/utils/__tests__/goalReplayTarget.test.js
// Which goal a shot-map dot's replay asks for. The dots arrive by two
// routes that identify a goal differently: the season aggregate carries
// each row's own game and NHL event id, a single game's events carry the
// event id as the dot's `id` and belong to the game on screen.

import { describe, it, expect } from 'vitest'
import { goalReplayTarget } from '../goalReplayTarget'

const SINGLE_GAME = { isAllN: false, gameId: 2025030311 }
const SEASON = { isAllN: true, gameId: null }

describe('goalReplayTarget', () => {
  it('uses the game on screen and the dot’s own id for a single game', () => {
    const goal = { type: 'goal', id: 59 }
    expect(goalReplayTarget(goal, SINGLE_GAME)).toEqual({ gameId: 2025030311, eventId: 59 })
  })

  it('uses a season row’s own game and event, so any game that season can be replayed', () => {
    const row = { type: 'goal', id: '2025020500-80-3-1-09:14', gameId: 2025020500, eventId: 173 }
    expect(goalReplayTarget(row, SEASON)).toEqual({ gameId: 2025020500, eventId: 173 })
  })

  it('never passes a season row’s composite id off as an NHL event id', () => {
    const preBackfill = { type: 'goal', id: '2022020400-80-3-1-09:14', gameId: 2022020400, eventId: null }
    expect(goalReplayTarget(preBackfill, SEASON)).toBeNull()
  })

  it('is null for anything that is not a goal', () => {
    for (const type of ['shot-on-goal', 'missed-shot', 'blocked-shot']) {
      expect(goalReplayTarget({ type, id: 59, gameId: 1, eventId: 2 }, SINGLE_GAME)).toBeNull()
    }
  })

  it('is null when there is no game to ask about', () => {
    expect(goalReplayTarget({ type: 'goal', id: 59 }, { isAllN: false, gameId: null })).toBeNull()
  })

  it('survives a missing or malformed event', () => {
    expect(goalReplayTarget(null, SINGLE_GAME)).toBeNull()
    expect(goalReplayTarget(undefined, SINGLE_GAME)).toBeNull()
    expect(goalReplayTarget({ type: 'goal' }, SINGLE_GAME)).toBeNull()
  })

  it('prefers the row’s own game even in a single-game view', () => {
    // Belt and braces: a row that knows its game is never re-pointed at
    // whichever game happens to be on screen.
    const row = { type: 'goal', id: 59, gameId: 2025020500, eventId: 173 }
    expect(goalReplayTarget(row, SINGLE_GAME)).toEqual({ gameId: 2025020500, eventId: 173 })
  })
})
