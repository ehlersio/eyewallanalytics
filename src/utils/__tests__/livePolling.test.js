// src/utils/__tests__/livePolling.test.js
import { describe, it, expect } from 'vitest'
import { livePollInterval } from '../livePolling.js'
import { withPbpScore } from '../nhlApi.js'

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

describe('withPbpScore', () => {
  const game = { id: 2026020006, homeTeam: { abbrev: 'PHI', score: 0 }, awayTeam: { abbrev: 'PIT', score: 1 } }
  const pbp = (id, home, away) => ({ id, homeTeam: { score: home }, awayTeam: { score: away } })

  // PIT @ PHI, 2026-09-30: the second goal's popup (pbp) with the score
  // bar (schedule) still at 1-0.
  it("takes the score from that game's pbp", () => {
    expect(withPbpScore(game, pbp(2026020006, 0, 2))).toMatchObject({ homeTeam: { abbrev: 'PHI', score: 0 }, awayTeam: { abbrev: 'PIT', score: 2 } })
  })

  it("leaves the game alone for another game's pbp, or none", () => {
    expect(withPbpScore(game, pbp(2026020007, 3, 3))).toBe(game)
    expect(withPbpScore(game, null)).toBe(game)
    expect(withPbpScore(null, pbp(1, 0, 0))).toBe(null)
  })
})
