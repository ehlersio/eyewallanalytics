// src/utils/__tests__/summaryList.test.js
// withSummary: a period summary built for the game shown before must not
// land in the list of the game on screen now -- it showed in the bell as
// one of that game's, and relit the bell's dot after a reload
// (period-summary.cy.js, 2026-10-07).

import { describe, it, expect } from 'vitest'
import { sameGame, withSummary } from '../summaryList.js'

const s = (gameId, period) => ({ gameId, period })

describe('withSummary', () => {
  it('adds a summary of the game on screen, in period order', () => {
    expect(withSummary([s(2, 1), s(2, 3)], s(2, 2), 2)).toEqual([s(2, 1), s(2, 2), s(2, 3)])
  })

  it('replaces that period’s summary rather than adding a second', () => {
    const rebuilt = { ...s(2, 1), aiNarrative: 'new' }
    expect(withSummary([s(2, 1), s(2, 2)], rebuilt, 2)).toEqual([rebuilt, s(2, 2)])
  })

  it('drops a summary built for the game shown before', () => {
    // The last final's P3 finishing after the view switched to the mock
    // (or newly live) game.
    const list = [s(2025030311, 1)]
    expect(withSummary(list, s(2026020045, 3), 2025030311)).toBe(list)
    expect(withSummary([], s(2026020045, 1), 2025030311)).toEqual([])
  })

  it('matches a game id given as a string or a number', () => {
    expect(withSummary([], s('2025030311', 1), 2025030311)).toEqual([s('2025030311', 1)])
  })

  it('adds nothing while no game is on screen', () => {
    expect(withSummary([], s(1, 1), null)).toEqual([])
    expect(withSummary([], s(1, 1), undefined)).toEqual([])
  })
})

describe('sameGame', () => {
  it('is one game whether its id is a number or a string', () => {
    expect(sameGame(2025030311, '2025030311')).toBe(true)
    expect(sameGame(2025030311, 2026020045)).toBe(false)
  })

  it('is no game without an id', () => {
    expect(sameGame(null, null)).toBe(false)
    expect(sameGame(undefined, 1)).toBe(false)
  })
})
