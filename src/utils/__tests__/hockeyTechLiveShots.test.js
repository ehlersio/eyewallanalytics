// src/utils/__tests__/hockeyTechLiveShots.test.js
// A live AHL/ECHL game's shots for the Shot Map rink, from /{league}/live.
// The fixtures are real: AHL 1029081 (CLT at HER, 2026-10-03, 5-2 CLT) as
// /ahl/live/1029081 answered it, and the same game's stored shots as
// /ahl/game-shots answered it after the nightly (trimmed to the columns the
// rink reads), so the live rows can be checked against what the pipeline
// stored from the same play-by-play.

import { describe, it, expect } from 'vitest'
import { liveShotRows, transformCoords } from '../hockeyTechLiveShots'
import live from './fixtures/ahl-game-1029081/live.json'
import stored from './fixtures/ahl-game-1029081/game-shots.json'
import echlLive from './fixtures/game-events-replay/echl-24296-live.json'

const HER = 319
const CLT = 384
const key = r => `${r.event_type}|${r.period_id}|${r.time_seconds}|${r.team_id}|${r.shooter_id}`

describe('transformCoords', () => {
  it('matches the pipeline transform for both teams and both ends', () => {
    // HER's first goal (home, P1) and CLT's first shot (away, P1), as stored.
    expect(transformCoords(64, 207, true, 1)).toEqual({ x: -78.67, y: 16.15 })
    expect(transformCoords(477, 115, false, 1)).toEqual({ x: -59, y: 9.92 })
    // Even periods flip both.
    expect(transformCoords(477, 115, false, 2)).toEqual({ x: 59, y: -9.92 })
  })
})

describe('liveShotRows', () => {
  const rows = liveShotRows(live)

  it('gives one row per shot and goal, each goal once', () => {
    const goals = live.events.filter(e => e.eventType === 'goal').length
    const shotsNotGoals = live.events.filter(e => e.eventType === 'shot' && !e.isGoal).length
    expect(rows).toHaveLength(goals + shotsNotGoals)
    expect(rows.filter(r => r.event_type === 'goal')).toHaveLength(7)
    // CLT won 5-2.
    expect(rows.filter(r => r.event_type === 'goal' && r.team_id === CLT)).toHaveLength(5)
    expect(rows.filter(r => r.event_type === 'goal' && r.team_id === HER)).toHaveLength(2)
    expect(new Set(rows.map(r => r.id)).size).toBe(rows.length)
  })

  it('matches the nightly’s stored shots for the same game, row for row', () => {
    expect(rows).toHaveLength(stored.length)
    const byKey = new Map(stored.map(r => [key(r), r]))
    for (const r of rows) {
      const s = byKey.get(key(r))
      expect(s, key(r)).toBeDefined()
      expect(r.x_norm).toBeCloseTo(s.x_norm, 1)
      expect(r.y_norm).toBeCloseTo(s.y_norm, 1)
      expect(r.shot_type).toBe(s.shot_type)
      expect(r.game_id).toBe(s.game_id)
    }
  })

  it('names the shooter or scorer from the feed', () => {
    const firstGoal = rows.find(r => r.event_type === 'goal')
    expect(firstGoal).toMatchObject({ team_id: HER, shooter_id: 8641, shooter_name: 'Josh Dunne', period_id: 1, time_seconds: 188 })
    expect(rows[0]).toMatchObject({ event_type: 'shot', shooter_name: 'Kai Schwindt', shot_type: 'Default' })
  })

  it('reads an ECHL game the same way, overtime included', () => {
    const echl = liveShotRows(echlLive)
    expect(echl.filter(r => r.event_type === 'goal')).toHaveLength(echlLive.events.filter(e => e.eventType === 'goal').length)
    expect(echl.some(r => r.period_id === 4)).toBe(true)
    expect(echl.every(r => Number.isFinite(r.x_norm) && Math.abs(r.x_norm) <= 100 && Math.abs(r.y_norm) <= 42.5)).toBe(true)
  })

  it('keeps a goal the feed did not place, drops such a shot, and skips other events', () => {
    const payload = {
      gameId: 9, homeTeamId: 1, awayTeamId: 2,
      events: [
        { eventType: 'shot', period: 1, timeSeconds: 10, teamId: 1, shooter: { id: 5 }, isGoal: false, x: null, y: null },
        { eventType: 'goal', period: 1, timeSeconds: 20, teamId: 2, scoredBy: { id: 6 }, x: null, y: null },
        { eventType: 'penaltyshot', period: 2, timeSeconds: 30, teamId: 1, isGoal: true },
        { eventType: 'shootout', period: 7, timeSeconds: 0, teamId: 2, isGoal: true },
        { eventType: 'penalty', period: 1, timeSeconds: 40, teamId: 1 },
      ],
    }
    expect(liveShotRows(payload)).toEqual([expect.objectContaining({ event_type: 'goal', team_id: 2, x_norm: null, y_norm: null })])
  })

  it('is empty without a payload', () => {
    expect(liveShotRows(null)).toEqual([])
    expect(liveShotRows({ gameId: 1, events: null })).toEqual([])
  })
})
