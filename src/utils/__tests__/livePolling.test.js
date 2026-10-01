// src/utils/__tests__/livePolling.test.js
import { describe, it, expect } from 'vitest'
import { livePollInterval } from '../livePolling.js'

const NOW = Date.parse('2026-09-30T23:00:00Z')
const at = (mins, gameState = 'FUT') => ({ gameState, startTimeUTC: new Date(NOW + mins * 60_000).toISOString() })

describe('livePollInterval', () => {
  it('polls every 20s while live', () => {
    expect(livePollInterval([], true, NOW)).toBe(20_000)
  })

  it('tightens as puck drop nears, asked again each time', () => {
    const games = [at(240)]
    expect(livePollInterval(games, false, NOW)).toBe(5 * 60_000)
    expect(livePollInterval(games, false, NOW + 61 * 60_000)).toBe(60_000)       // 179 min out
    expect(livePollInterval(games, false, NOW + 236 * 60_000)).toBe(20_000)      // 4 min out
  })

  // PIT @ PHI, 2026-09-30: scheduled 23:30, Game Starting pushed 23:36.
  // The old interval looked past a started game to the next one.
  it('stays at 20s past the scheduled start until the game goes live', () => {
    expect(livePollInterval([at(-6, 'PRE'), at(2 * 24 * 60)], false, NOW)).toBe(20_000)
  })

  it('ignores finished games and a start long past that never went live', () => {
    expect(livePollInterval([at(-10, 'OFF'), at(-90), at(24 * 60)], false, NOW)).toBe(5 * 60_000)
  })

  it('checks every minute until the schedule loads, every 30 with nothing ahead', () => {
    expect(livePollInterval(null, false, NOW)).toBe(60_000)
    expect(livePollInterval([at(-300, 'OFF')], false, NOW)).toBe(30 * 60_000)
  })
})
