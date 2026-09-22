// src/utils/__tests__/liveGameHold.test.js
import { describe, it, expect } from 'vitest'
import { createLiveGameHold } from '../liveGameHold.js'

const FINAL = new Set(['OFF', 'FINAL'])
const isCompleted = g => FINAL.has(g.gameState)
const live = { id: 1, gameState: 'LIVE' }

describe('createLiveGameHold', () => {
  it('passes a live game straight through', () => {
    const hold = createLiveGameHold(isCompleted)
    expect(hold(live, [live])).toBe(live)
  })

  it('holds a live game through an empty or lagging read', () => {
    const hold = createLiveGameHold(isCompleted)
    hold(live, [live])
    expect(hold(null, [])).toBe(live)                                   // failed fetch
    expect(hold(null, [{ id: 1, gameState: 'PRE' }])).toBe(live)        // schedule behind
    expect(hold(live, [live])).toBe(live)                               // back, count resets
    expect(hold(null, [])).toBe(live)
    expect(hold(null, [])).toBe(live)
  })

  it('lets go once the schedule says the game is over', () => {
    const hold = createLiveGameHold(isCompleted)
    hold(live, [live])
    expect(hold(null, [{ id: 1, gameState: 'FINAL' }])).toBe(null)
    expect(hold(null, [])).toBe(null)
  })

  it('lets go after the miss tolerance', () => {
    const hold = createLiveGameHold(isCompleted, 3)
    hold(live, [live])
    expect(hold(null, [])).toBe(live)
    expect(hold(null, [])).toBe(live)
    expect(hold(null, [])).toBe(null)
  })

  it('holds nothing when nothing was ever live', () => {
    const hold = createLiveGameHold(isCompleted)
    expect(hold(null, [])).toBe(null)
  })
})
