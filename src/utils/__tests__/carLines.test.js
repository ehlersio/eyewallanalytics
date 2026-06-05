// src/utils/__tests__/carLines.test.js
// Unit tests for:
//   - carLines.js  static line data shape and correctness
//   - supabaseClient.js  sortForwardLine + buildStaticPosMap (pure logic only)
//
// No network calls — all logic is extracted inline to mirror the
// production implementation without importing the full module.

import { describe, it, expect } from 'vitest'
import { CAR_STATIC_LINES, getStaticLines } from '../carLines.js'

// ── Pure helpers mirrored from supabaseClient.js ──────────────
// Kept here so we can test the sort logic without Supabase imports.

const FWD_ORDER = { L: 0, LW: 0, C: 1, R: 2, RW: 2 }

function buildStaticPosMap(staticData) {
  const map = new Map()
  for (const line of (staticData?.lines || [])) {
    for (const p of line.players) map.set(p.name, p.pos)
  }
  return map
}

function sortForwardLine(players, posMap) {
  return [...players]
    .map(p => ({ ...p, pos: posMap?.get(p.name) ?? p.pos }))
    .sort((a, b) => {
      const ao = FWD_ORDER[a.pos] ?? 1
      const bo = FWD_ORDER[b.pos] ?? 1
      return ao - bo
    })
}

// ── carLines static data shape ────────────────────────────────

describe('CAR_STATIC_LINES shape', () => {
  it('has a regular season entry', () => {
    expect(CAR_STATIC_LINES.regular).toBeDefined()
  })

  it('regular season has exactly 4 forward lines', () => {
    expect(CAR_STATIC_LINES.regular.lines).toHaveLength(4)
  })

  it('regular season has exactly 3 defence pairs', () => {
    expect(CAR_STATIC_LINES.regular.pairs).toHaveLength(3)
  })

  it('every forward line has exactly 3 players', () => {
    for (const line of CAR_STATIC_LINES.regular.lines) {
      expect(line.players).toHaveLength(3)
    }
  })

  it('every defence pair has exactly 2 players', () => {
    for (const pair of CAR_STATIC_LINES.regular.pairs) {
      expect(pair.players).toHaveLength(2)
    }
  })

  it('every forward line player has a name and position', () => {
    for (const line of CAR_STATIC_LINES.regular.lines) {
      for (const p of line.players) {
        expect(p.name).toBeTruthy()
        expect(p.pos).toBeTruthy()
      }
    }
  })

  it('every defence pair player has pos D', () => {
    for (const pair of CAR_STATIC_LINES.regular.pairs) {
      for (const p of pair.players) {
        expect(p.pos).toBe('D')
      }
    }
  })

  it('lines are ranked 1–4 in order', () => {
    const ranks = CAR_STATIC_LINES.regular.lines.map(l => l.rank)
    expect(ranks).toEqual([1, 2, 3, 4])
  })

  it('pairs are ranked 1–3 in order', () => {
    const ranks = CAR_STATIC_LINES.regular.pairs.map(p => p.rank)
    expect(ranks).toEqual([1, 2, 3])
  })
})

// ── getStaticLines ────────────────────────────────────────────

describe('getStaticLines', () => {
  it('returns regular season lines for gameType 2', () => {
    const data = getStaticLines(2)
    expect(data).toBe(CAR_STATIC_LINES.regular)
  })

  it('returns regular season lines for gameType 3 when no playoff override', () => {
    // playoff is null in carLines.js — falls back to regular
    const data = getStaticLines(3)
    expect(data).toBe(CAR_STATIC_LINES.regular)
  })

  it('defaults to regular season when no gameType passed', () => {
    const data = getStaticLines()
    expect(data).toBe(CAR_STATIC_LINES.regular)
  })
})

// ── LW / C / RW position ordering ────────────────────────────

describe('sortForwardLine — LW → C → RW order', () => {
  const staticData = CAR_STATIC_LINES.regular
  const posMap = buildStaticPosMap(staticData)

  it('Line 1: Svechnikov (LW), Aho (C), Jarvis (RW)', () => {
    // Simulate DB returning players in arbitrary order (alphabetical by player_id)
    const dbOrder = [
      { name: 'Sebastian Aho',      pos: 'C' },
      { name: 'Andrei Svechnikov',  pos: 'L' },
      { name: 'Seth Jarvis',        pos: 'R' },
    ]
    const sorted = sortForwardLine(dbOrder, posMap)
    expect(sorted[0].name).toBe('Andrei Svechnikov')
    expect(sorted[1].name).toBe('Sebastian Aho')
    expect(sorted[2].name).toBe('Seth Jarvis')
  })

  it('Line 2: Hall (LW), Stankoven (C), Blake (RW)', () => {
    const dbOrder = [
      { name: 'Jackson Blake',    pos: 'R' },
      { name: 'Logan Stankoven', pos: 'C' },
      { name: 'Taylor Hall',     pos: 'L' },
    ]
    const sorted = sortForwardLine(dbOrder, posMap)
    expect(sorted[0].name).toBe('Taylor Hall')
    expect(sorted[1].name).toBe('Logan Stankoven')
    expect(sorted[2].name).toBe('Jackson Blake')
  })

  it('Line 3: Ehlers (LW), Staal (C), Martinook (RW)', () => {
    const dbOrder = [
      { name: 'Jordan Martinook', pos: 'R' },
      { name: 'Jordan Staal',     pos: 'C' },
      { name: 'Nikolaj Ehlers',   pos: 'L' },
    ]
    const sorted = sortForwardLine(dbOrder, posMap)
    expect(sorted[0].name).toBe('Nikolaj Ehlers')
    expect(sorted[1].name).toBe('Jordan Staal')
    expect(sorted[2].name).toBe('Jordan Martinook')
  })

  it('Line 4: Carrier (LW), Jankowski (C), Robinson (RW)', () => {
    const dbOrder = [
      { name: 'Eric Robinson',    pos: 'R' },
      { name: 'Mark Jankowski',   pos: 'C' },
      { name: 'William Carrier',  pos: 'L' },
    ]
    const sorted = sortForwardLine(dbOrder, posMap)
    expect(sorted[0].name).toBe('William Carrier')
    expect(sorted[1].name).toBe('Mark Jankowski')
    expect(sorted[2].name).toBe('Eric Robinson')
  })

  it('posMap overrides null pos from DB', () => {
    // Simulate DB returning null positions (common edge case)
    const dbOrder = [
      { name: 'Sebastian Aho',     pos: null },
      { name: 'Andrei Svechnikov', pos: null },
      { name: 'Seth Jarvis',       pos: null },
    ]
    const sorted = sortForwardLine(dbOrder, posMap)
    expect(sorted[0].name).toBe('Andrei Svechnikov')
    expect(sorted[1].name).toBe('Sebastian Aho')
    expect(sorted[2].name).toBe('Seth Jarvis')
  })

  it('posMap overrides undefined pos from DB', () => {
    const dbOrder = [
      { name: 'Seth Jarvis',       pos: undefined },
      { name: 'Sebastian Aho',     pos: undefined },
      { name: 'Andrei Svechnikov', pos: undefined },
    ]
    const sorted = sortForwardLine(dbOrder, posMap)
    expect(sorted[0].name).toBe('Andrei Svechnikov')
    expect(sorted[1].name).toBe('Sebastian Aho')
    expect(sorted[2].name).toBe('Seth Jarvis')
  })

  it('unknown player without posMap entry defaults to C slot (middle)', () => {
    // A callup not in static data — pos unknown, treated as C (FWD_ORDER default = 1)
    const dbOrder = [
      { name: 'Unknown Callup', pos: null },
      { name: 'Taylor Hall',    pos: 'L'  },
      { name: 'Jackson Blake',  pos: 'R'  },
    ]
    const sorted = sortForwardLine(dbOrder, posMap)
    expect(sorted[0].name).toBe('Taylor Hall')   // LW = 0
    expect(sorted[1].name).toBe('Unknown Callup') // default = 1 (C slot)
    expect(sorted[2].name).toBe('Jackson Blake')  // RW = 2
  })

  it('handles LW and RW aliases (in case API ever returns long form)', () => {
    const players = [
      { name: 'A', pos: 'RW' },
      { name: 'B', pos: 'C'  },
      { name: 'C', pos: 'LW' },
    ]
    const sorted = sortForwardLine(players, null)
    expect(sorted[0].pos).toBe('LW')
    expect(sorted[1].pos).toBe('C')
    expect(sorted[2].pos).toBe('RW')
  })

  it('is stable — does not mutate the input array', () => {
    const players = [
      { name: 'Seth Jarvis',       pos: 'R' },
      { name: 'Andrei Svechnikov', pos: 'L' },
      { name: 'Sebastian Aho',     pos: 'C' },
    ]
    const original = players.map(p => ({ ...p }))
    sortForwardLine(players, posMap)
    expect(players).toEqual(original)
  })
})

// ── buildStaticPosMap ─────────────────────────────────────────

describe('buildStaticPosMap', () => {
  it('returns a Map with one entry per forward player', () => {
    const map = buildStaticPosMap(CAR_STATIC_LINES.regular)
    // 4 lines × 3 players = 12 forwards
    expect(map.size).toBe(12)
  })

  it('maps Aho to C', () => {
    const map = buildStaticPosMap(CAR_STATIC_LINES.regular)
    expect(map.get('Sebastian Aho')).toBe('C')
  })

  it('maps Svechnikov to L', () => {
    const map = buildStaticPosMap(CAR_STATIC_LINES.regular)
    expect(map.get('Andrei Svechnikov')).toBe('L')
  })

  it('maps Jarvis to R', () => {
    const map = buildStaticPosMap(CAR_STATIC_LINES.regular)
    expect(map.get('Seth Jarvis')).toBe('R')
  })

  it('handles null staticData gracefully', () => {
    const map = buildStaticPosMap(null)
    expect(map.size).toBe(0)
  })

  it('handles staticData with no lines gracefully', () => {
    const map = buildStaticPosMap({ lines: [], pairs: [] })
    expect(map.size).toBe(0)
  })
})

// ── static lines are already in LW/C/RW order ────────────────

describe('carLines.js static data — players already in LW/C/RW order', () => {
  it('every forward line has LW first, C second, RW third', () => {
    const EXPECTED_ORDER = ['L', 'C', 'R']
    for (const line of CAR_STATIC_LINES.regular.lines) {
      const positions = line.players.map(p => p.pos)
      expect(positions).toEqual(EXPECTED_ORDER)
    }
  })
})
