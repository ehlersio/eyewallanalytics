// src/brand/__tests__/faceoffTimeline.test.js
// The faceoff intro has to start and end on exactly the static mark, since
// it hands off from the launch splash and hands over to the header logo.

import { describe, it, expect } from 'vitest'
import {
  INTRO_DURATION_MS, introFrame, loaderFrame, stickPoints,
  VETERANS_DURATION_MS, veteransFrame, MEMORIAL_DURATION_MS, memorialFrame,
  OFFSEASON_DURATION_MS, offseasonFrame, ZAMBONI_FRAMES,
} from '../faceoffTimeline'
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

describe('veteransFrame', () => {
  const at = units => veteransFrame(VETERANS_DURATION_MS * (units / 3300))

  it('starts and ends on the finished mark, like the regular intro', () => {
    for (const ms of [0, VETERANS_DURATION_MS, VETERANS_DURATION_MS + 500]) {
      const f = veteransFrame(ms)
      expect(f.letter).toEqual(FULL_LETTER)
      expect(f.puck.x).toBeCloseTo(MARK.center, 6)
      expect(f.puck.y).toBeCloseTo(MARK.center, 6)
      expect(f.puck).toMatchObject({ r: MARK.dot.r, isDot: true })
      expect(f.home.x).toBeLessThan(0)
      expect(f.away.x).toBeGreaterThan(100)
      expect(f.ref.y).toBeLessThan(0)
      expect(f.ref.salute).toBe(0)
    }
  })

  it('never battles for the puck: it sits still on the dot once dropped', () => {
    for (let units = 1700; units < 2650; units += 25) {
      const f = at(units)
      expect(f.puck.x).toBe(MARK.center)
      expect(f.puck.y).toBe(MARK.center)
    }
  })

  it('salutes, drops the puck, then taps sticks, in that order', () => {
    expect(at(850).ref.salute).toBe(0)
    expect(at(1150).ref.salute).toBe(1)
    expect(at(1150).puck.r).toBe(0)
    expect(at(1500).ref.salute).toBe(0)
    expect(at(1500).puck.r).toBeGreaterThan(0)
    expect(at(1500).ripples).toEqual([null, null])
    expect(at(1680 + 160 + 20).ripples[0]).not.toBeNull()
  })

  it('lifts the sticks mid-tap', () => {
    expect(at(1680 + 80).home.stick[1][0]).toBeLessThan(at(1600).home.stick[1][0])
  })

  it('leaves each ripple where the blade landed while the players skate off', () => {
    expect(at(2160 + 100).ripples[0].x).toBeCloseTo(36 + 11, 6)
  })
})

describe('memorialFrame', () => {
  const at = units => memorialFrame(MEMORIAL_DURATION_MS * (units / 3300))

  it('holds a moment of silence: everyone on their marks, no puck', () => {
    for (let units = 900; units < 1900; units += 50) {
      const f = at(units)
      expect(f.home.x).toBeCloseTo(36, 6)
      expect(f.away.x).toBeCloseTo(64, 6)
      expect(f.ref.y).toBeCloseTo(33, 6)
      expect(f.puck.r).toBe(0)
      expect(f.home.stick).toEqual(at(900).home.stick)
    }
  })

  it('starts and ends on the finished mark', () => {
    for (const ms of [0, MEMORIAL_DURATION_MS]) {
      const f = memorialFrame(ms)
      expect(f.letter).toEqual(FULL_LETTER)
      expect(f.puck).toMatchObject({ x: MARK.center, y: MARK.center, r: MARK.dot.r, isDot: true })
      expect(f.ref.y).toBeLessThan(0)
    }
  })
})

describe('offseasonFrame', () => {
  const at = units => offseasonFrame(OFFSEASON_DURATION_MS * (units / 3300))

  it('starts and ends on the finished mark, with no Zamboni showing', () => {
    for (const ms of [0, OFFSEASON_DURATION_MS]) {
      const f = offseasonFrame(ms)
      expect(f.letter).toEqual(FULL_LETTER)
      expect(f.puck).toMatchObject({ r: MARK.dot.r, isDot: true })
      expect(f.zamboni.opacity).toBe(0)
    }
    expect(offseasonFrame(OFFSEASON_DURATION_MS).zamboni.trail.opacity).toBe(0)
  })

  it('drives the Zamboni left to right across an empty rink, laying fresh ice behind it', () => {
    const early = at(800)
    const late = at(1900)
    expect(early.zamboni.opacity).toBe(1)
    expect(late.zamboni.x).toBeGreaterThan(early.zamboni.x)
    expect(late.zamboni.trail.x1).toBeGreaterThan(early.zamboni.trail.x1)
    expect(early.home.x).toBeLessThan(0)
    expect(early.ref).toBeNull()
    expect(early.puck.r).toBe(0)
    for (let units = 300; units < 2400; units += 37) {
      const { frame } = at(units).zamboni
      expect(frame).toBeGreaterThanOrEqual(0)
      expect(frame).toBeLessThan(ZAMBONI_FRAMES)
    }
  })
})

describe('stickPoints lift', () => {
  it('shortens the stick as it comes off the ice', () => {
    const flat = stickPoints(36, 50, 0)[1][0]
    const lifted = stickPoints(36, 50, 0, 1)[1][0]
    expect(lifted).toBeLessThan(flat)
  })
})
