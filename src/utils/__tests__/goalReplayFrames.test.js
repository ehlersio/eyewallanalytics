// src/utils/__tests__/goalReplayFrames.test.js
// The goal Tracking replay's frame math: the window around the goal,
// interpolation between the 10 Hz samples, turning every goal to the
// right-hand net, the puck trail, and team dot colours.

import { describe, it, expect } from 'vitest'
import {
  replayWindow, orient, sampleAt, puckTrail, cameraFocus, dotColours, inkFor, NEUTRAL_DOT,
  LEAD_FRAMES, TAIL_FRAMES, TRAIL_FRAMES,
} from '../goalReplayFrames'

function replay({ n = 140, goalFrame = 100, attacksRight = true } = {}) {
  const frames = Array.from({ length: n }, (_, i) => ({
    puck: i === 50 ? null : [i * 0.5, 1],
    at: i < 60 ? { a: [i, 2], b: [10, -3] } : { a: [i, 2], c: [20, 5] },
  }))
  return { hz: 10, goalFrame, attacksRight, frames, players: {}, teams: { home: 'CAR', away: 'FLA' } }
}

describe('replayWindow', () => {
  it('shows the lead-up and a little after the goal', () => {
    expect(replayWindow(replay())).toEqual({ start: 100 - LEAD_FRAMES, end: 100 + TAIL_FRAMES })
  })

  it('stays inside the frames it has', () => {
    expect(replayWindow(replay({ n: 60, goalFrame: 50 }))).toEqual({ start: 0, end: 59 })
  })
})

describe('orient', () => {
  it('turns a left-hand goal 180 degrees so every goal is in the right-hand net', () => {
    expect(orient([80, 10], true)).toEqual([80, 10])
    expect(orient([-80, 10], false)).toEqual([80, -10])
  })
})

describe('sampleAt', () => {
  it('interpolates between samples', () => {
    const { players, puck } = sampleAt(replay(), 10.5)
    expect(players.find(p => p.id === 'a').pos).toEqual([10.5, 2])
    expect(puck).toEqual([5.25, 1])
  })

  it('holds a player leaving the ice and waits for one joining', () => {
    const at59 = sampleAt(replay(), 59.5)
    expect(at59.players.map(p => p.id).sort()).toEqual(['a', 'b'])
    expect(at59.players.find(p => p.id === 'b').pos).toEqual([10, -3])
  })

  it('has no puck where tracking lost it, and never interpolates across the gap', () => {
    expect(sampleAt(replay(), 50.2).puck).toBeNull()
    expect(sampleAt(replay(), 49.5).puck).toEqual([24.5, 1]) // next sample missing: hold
  })

  it('orients everything for a left-hand goal', () => {
    const { players, puck } = sampleAt(replay({ attacksRight: false }), 10)
    expect(players.find(p => p.id === 'a').pos).toEqual([-10, -2])
    expect(puck).toEqual([-5, -1])
  })

  it('clamps outside the frames', () => {
    expect(sampleAt(replay(), 500).puck).toEqual([69.5, 1])
    expect(sampleAt(replay(), -5).puck).toEqual([0, 1])
  })
})

describe('puckTrail', () => {
  it('is the recent path, oldest first, skipping lost frames', () => {
    const trail = puckTrail(replay(), 55)
    expect(trail).toHaveLength(TRAIL_FRAMES) // 43..55 minus the lost 50
    expect(trail[0]).toEqual([21.5, 1])
    expect(trail.at(-1)).toEqual([27.5, 1])
  })
})

describe('dotColours', () => {
  const colours = { CAR: '#ff0f0f', DET: '#ef384c', FLA: '#5b9ef9' }
  const colourOf = (abbr) => colours[abbr] ?? null

  it('keeps both teams’ colours when they are easy to tell apart', () => {
    expect(dotColours('CAR', 'FLA', colourOf)).toEqual({ CAR: '#ff0f0f', FLA: '#5b9ef9' })
  })

  it('turns the other team grey when both are red', () => {
    expect(dotColours('CAR', 'DET', colourOf)).toEqual({ CAR: '#ff0f0f', DET: NEUTRAL_DOT })
  })

  it('falls back to the app’s text tones for a team without a colour', () => {
    expect(dotColours('CAR', 'ARI', colourOf)).toEqual({ CAR: '#ff0f0f', ARI: 'var(--text-dim)' })
  })
})

describe('inkFor', () => {
  it('puts dark numbers on light dots and white on dark ones', () => {
    expect(inkFor('#ffb81c')).toBe('#0c1120')
    expect(inkFor('#041e42')).toBe('#ffffff')
    expect(inkFor('var(--text)')).toBe('#0c1120')
  })
})

describe('cameraFocus', () => {
  it('moves continuously between frames rather than in whole-frame steps', () => {
    const r = replay()
    const a = cameraFocus(r, 60)
    const b = cameraFocus(r, 60.5)
    const c = cameraFocus(r, 61)
    expect(b).toBeGreaterThan(a)
    expect(b).toBeLessThan(c)
    expect(Math.abs(cameraFocus(r, 60.01) - a)).toBeLessThan(0.05)
  })

  it('weights the puck’s newest positions most', () => {
    const r = replay()
    const newest = sampleAt(r, 60).puck[0]
    const oldest = sampleAt(r, 45).puck[0]
    const plain = (newest + oldest) / 2
    expect(cameraFocus(r, 60)).toBeGreaterThan(plain)
  })
})
