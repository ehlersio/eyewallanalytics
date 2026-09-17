// src/brand/__tests__/faceoffTimeline.test.js
// The faceoff intro has to start and end on exactly the static mark, since
// it hands off from the launch splash and hands over to the header logo.

import { describe, it, expect } from 'vitest'
import { INTRO_DURATION_MS, introFrame, loaderFrame, stickPoints } from '../faceoffTimeline'
import { MARK } from '../rinkMark'

const FULL_LETTER = { spine: 1, top: 1, bottom: 1, middle: 1 }

describe('introFrame', () => {
  it('starts on the finished mark: full E, dot at center, players offstage', () => {
    const f = introFrame(0)
    expect(f.letter).toEqual(FULL_LETTER)
    expect(f.puck).toMatchObject({ x: MARK.center, y: MARK.center, r: MARK.dot.r, isDot: true })
    expect(f.home.x).toBeLessThan(0)
    expect(f.away.x).toBeGreaterThan(100)
    expect(f.ref.y).toBeLessThan(0)
  })

  it('ends on the finished mark, and stays there past the end', () => {
    for (const ms of [INTRO_DURATION_MS, INTRO_DURATION_MS + 500]) {
      const f = introFrame(ms)
      expect(f.letter).toEqual(FULL_LETTER)
      expect(f.puck.x).toBeCloseTo(MARK.center, 6)
      expect(f.puck.y).toBeCloseTo(MARK.center, 6)
      expect(f.puck).toMatchObject({ r: MARK.dot.r, isDot: true })
      expect(f.home.x).toBeLessThan(0)
      expect(f.away.x).toBeGreaterThan(100)
      expect(f.ref.y).toBeLessThan(0)
    }
  })

  it('clears the E and has both centers on the dot for the draw', () => {
    const f = introFrame(INTRO_DURATION_MS * 0.5)
    expect(f.letter).toEqual({ spine: 0, top: 0, bottom: 0, middle: 0 })
    expect(f.home.x).toBeCloseTo(36, 6)
    expect(f.away.x).toBeCloseTo(64, 6)
    expect(f.puck.r).toBeGreaterThan(0)
    expect(f.puck.isDot).toBe(false)
  })

  it('hides the puck between clearing the dot and the drop', () => {
    expect(introFrame(INTRO_DURATION_MS * (600 / 3300)).puck.r).toBe(0)
  })
})

describe('loaderFrame', () => {
  it('keeps both players on their marks and the puck near center', () => {
    for (const ms of [0, 250, 1000, 5000]) {
      const f = loaderFrame(ms)
      expect(f.home.x).toBe(36)
      expect(f.away.x).toBe(64)
      expect(Math.abs(f.puck.x - MARK.center)).toBeLessThanOrEqual(2)
    }
  })
})

describe('stickPoints', () => {
  it('reaches from the player toward the puck at angle 0', () => {
    const [[x0, y0], [tipX, tipY]] = stickPoints(36, 50, 0)
    expect([x0, y0]).toEqual([36, 50])
    expect(tipX).toBeCloseTo(47, 6)
    expect(tipY).toBeCloseTo(50, 6)
  })
})
