// src/utils/__tests__/teamSeasons.test.js
// PWHL/AHL/ECHL season pickers offer only seasons the selected team has
// games in, and open on its newest one when the current season has none
// (#15, #33). The schedules are the Worker's real /{league}/schedule
// answers on 2026-10-05 (fixtures/team-season-schedules.json):
//   PWHL DET (10): no games before 2026-27 -- 2 preseason (10), 30 in 11
//   PWHL SEA (8):  2025-26 only, missed the 2026 playoffs
//   PWHL BOS (1):  every season but the 2025 playoffs (6)
//   AHL HAM (457): nothing in 2025-26 (90) or the 2026 playoffs (92)
//   ECHL ADK (74): 2026-27 (78) not ingested yet

import { describe, it, expect, vi } from 'vitest'

vi.mock('../seasonClient', () => ({
  fetchSeasonsConfig: vi.fn(() => Promise.reject(new Error('offline in tests'))),
}))

import { summarizeSeasonGames, teamHasGames, seasonsWithGames, fallbackSeason } from '../teamSeasons'
import { PWHL_REGULAR_SEASONS, PWHL_PLAYOFF_SEASONS, PWHL_PRESEASON_SEASONS } from '../pwhlConfig'
import { AHL_SEASONS } from '../ahlConfig'
import { ECHL_SEASONS } from '../echlConfig'
import schedules from './fixtures/team-season-schedules.json'

const countsFor = (league, teamId) => Object.fromEntries(
  Object.entries(schedules[league][teamId]).map(([id, rows]) => [Number(id), summarizeSeasonGames(rows)])
)
const ids = seasons => seasons.map(s => s.id)
const PLAYED = { played: true }

describe('summarizeSeasonGames', () => {
  it('counts games and finished games', () => {
    expect(summarizeSeasonGames(schedules.ahl['457']['94'])).toEqual({ games: 72, finals: 2 })
    expect(summarizeSeasonGames(schedules.pwhl['10']['11'])).toEqual({ games: 30, finals: 0 })
    expect(summarizeSeasonGames([])).toEqual({ games: 0, finals: 0 })
  })

  it('reads a failed request as unknown, not empty', () => {
    expect(summarizeSeasonGames(null)).toBeNull()
    expect(teamHasGames({ 8: null }, 8)).toBeNull()
    expect(teamHasGames({}, 8)).toBeNull()
    expect(teamHasGames(null, 8)).toBeNull()
  })
})

describe('PWHL expansion team (DET)', () => {
  const counts = countsFor('pwhl', 10)

  it('offers no stats season: it has played no games', () => {
    expect(seasonsWithGames(PWHL_REGULAR_SEASONS, counts, PLAYED)).toEqual([])
    expect(seasonsWithGames(PWHL_PLAYOFF_SEASONS, counts, PLAYED)).toEqual([])
  })

  it('offers no listed schedule season but the 2026-27 preseason', () => {
    expect(seasonsWithGames(PWHL_REGULAR_SEASONS, counts)).toEqual([])
    expect(seasonsWithGames(PWHL_PLAYOFF_SEASONS, counts)).toEqual([])
    expect(ids(seasonsWithGames(PWHL_PRESEASON_SEASONS, counts))).toEqual([10])
  })

  it('opens the schedule on 2026-27, the upcoming season it has games in', () => {
    // PWHLScheduleView puts pwhl.next (11) first once its schedule has games.
    const next = { id: 11, label: '2026-27', type: 'regular' }
    const offered = [next, ...seasonsWithGames(PWHL_REGULAR_SEASONS, counts)]
    expect(fallbackSeason(8, offered, counts)).toBe(11)
  })

  it('stays on the current season when there is nothing to open instead', () => {
    expect(fallbackSeason(8, [], counts, PLAYED)).toBe(8)
  })
})

describe('PWHL SEA (2025-26 only, missed the playoffs)', () => {
  const counts = countsFor('pwhl', 8)

  it('offers 2025-26 and no earlier season', () => {
    expect(ids(seasonsWithGames(PWHL_REGULAR_SEASONS, counts, PLAYED))).toEqual([8])
  })

  it('offers no playoffs', () => {
    expect(seasonsWithGames(PWHL_PLAYOFF_SEASONS, counts, PLAYED)).toEqual([])
    expect(teamHasGames(counts, 9, PLAYED)).toBe(false)
  })

  it('keeps the current season it played', () => {
    expect(fallbackSeason(8, seasonsWithGames(PWHL_REGULAR_SEASONS, counts, PLAYED), counts, PLAYED)).toBe(8)
  })
})

describe('PWHL BOS', () => {
  const counts = countsFor('pwhl', 1)

  it('offers every regular season and only the playoffs it played in', () => {
    expect(ids(seasonsWithGames(PWHL_REGULAR_SEASONS, counts, PLAYED))).toEqual([8, 5, 1])
    expect(ids(seasonsWithGames(PWHL_PLAYOFF_SEASONS, counts, PLAYED))).toEqual([9, 3])
  })

  it('offers the 2026-27 preseason on the schedule, not as a stats season', () => {
    expect(teamHasGames(counts, 10)).toBe(true)
    expect(teamHasGames(counts, 10, PLAYED)).toBe(false)
  })
})

describe('AHL Hamilton (new in 2026-27)', () => {
  const counts = countsFor('ahl', 457)

  it('offers only 2026-27, on the schedule and for stats', () => {
    expect(ids(seasonsWithGames(AHL_SEASONS, counts))).toEqual([94])
    expect(ids(seasonsWithGames(AHL_SEASONS, counts, PLAYED))).toEqual([94])
  })

  it('opens on 2026-27 if the current season were 2025-26', () => {
    const offered = seasonsWithGames(AHL_SEASONS, counts, PLAYED)
    expect(fallbackSeason(90, offered, counts, PLAYED)).toBe(94)
  })
})

describe('AHL Hershey', () => {
  const counts = countsFor('ahl', 319)

  it('offers all three seasons', () => {
    expect(ids(seasonsWithGames(AHL_SEASONS, counts, PLAYED))).toEqual([94, 90, 92])
  })
})

describe('ECHL 2026-27 before it is ingested (#33)', () => {
  const counts = countsFor('echl', 74)

  it('offers no 2026-27 button while the team has no games in it', () => {
    expect(ids(seasonsWithGames(ECHL_SEASONS, counts))).toEqual([73, 76])
    expect(ids(seasonsWithGames(ECHL_SEASONS, counts, PLAYED))).toEqual([73, 76])
  })

  it('offers 2026-27 once its schedule is there, before a game is played', () => {
    // HockeyTech's first ADK game of 2026-27 (game 25494, 2026-10-17).
    const withSchedule = { ...counts, 78: summarizeSeasonGames([{ game_id: 25494, season_id: 78, game_state: '7:00 pm EDT' }]) }
    expect(ids(seasonsWithGames(ECHL_SEASONS, withSchedule))).toEqual([78, 73, 76])
    expect(ids(seasonsWithGames(ECHL_SEASONS, withSchedule, PLAYED))).toEqual([73, 76])
  })

  it('opens the stats views on 2025-26, not the playoffs, once 2026-27 is current but unplayed', () => {
    const offered = seasonsWithGames(ECHL_SEASONS, counts, PLAYED)
    expect(fallbackSeason(78, offered, counts, PLAYED)).toBe(73)
  })
})

describe('while the schedules load', () => {
  it('offers nothing and keeps the season', () => {
    expect(seasonsWithGames(AHL_SEASONS, null)).toEqual([])
    expect(fallbackSeason(94, [], null)).toBe(94)
  })

  it('keeps a season whose schedule could not be read', () => {
    expect(ids(seasonsWithGames(AHL_SEASONS, { 94: null, 90: { games: 0, finals: 0 }, 92: null }))).toEqual([94, 92])
  })
})
