// src/utils/__tests__/hockeyTechBracket.test.js
// AHL/ECHL League › Bracket (contract C11). fixtures/hockeytech-bracket/
// holds the Worker's real answers of 2026-10-08: /ahl/bracket (the 2026
// Calder Cup Playoffs, season 92), /ahl/bracket/projected
// (format-unverified: the AHL hasn't published 2027's format) and
// /echl/bracket/projected (no-games: the 2026-27 season hadn't started).

import { describe, it, expect } from 'vitest'
import ahl2026 from './fixtures/hockeytech-bracket/ahl-bracket-92.json'
import ahlProjected from './fixtures/hockeytech-bracket/ahl-projected-94.json'
import echlProjected from './fixtures/hockeytech-bracket/echl-projected-78.json'
import { bracketTabState, currentPlayoffSeason, gameSuffix, seriesStanding, winsNeeded } from '../hockeyTechBracket'
import { AHL } from '../hockeyTechLeagues'

const empty = { season: 95, format: null, rounds: [], source: 'feed' }

describe('bracketTabState', () => {
  it('shows this year’s playoffs once they have series', () => {
    expect(bracketTabState(ahl2026, ahlProjected, false)).toMatchObject({ mode: 'real', bracket: ahl2026 })
  })

  it('falls back to the projection, or a note for the Worker’s reason', () => {
    const projected = { ...ahlProjected, reason: undefined, rounds: [{ name: 'Division Semifinals', bestOf: 7, series: [{ id: 'North-1v4', top: { teamId: 74, seed: 1, wins: 0 }, bottom: { teamId: 113, seed: 4, wins: 0 }, status: 'scheduled' }] }] }
    expect(bracketTabState(empty, projected, false).mode).toBe('projected')
    expect(bracketTabState(empty, ahlProjected, false)).toEqual({ mode: 'note', bracket: null, reason: 'format-unverified' })
    expect(bracketTabState(null, echlProjected, false)).toEqual({ mode: 'note', bracket: null, reason: 'no-games' })
  })

  it('offers nothing when neither answers', () => {
    expect(bracketTabState(null, null, true).mode).toBe('loading')
    expect(bracketTabState(null, null, false).mode).toBe('none')
    expect(bracketTabState(empty, { rounds: [], reason: 'something-else' }, false).mode).toBe('none')
  })
})

describe('the 2026 Calder Cup bracket', () => {
  const [first, , , , final] = ahl2026.rounds

  it('needs 2 wins in a best-of-3 and 4 in a best-of-7', () => {
    expect(winsNeeded(first.bestOf, first.series[0])).toBe(2)
    expect(winsNeeded(final.bestOf, final.series[0])).toBe(4)
    expect(winsNeeded(null, { top: { wins: 3 }, bottom: { wins: 1 } })).toBe(3)
  })

  it('reads a finished series from the winner’s side', () => {
    // Atlantic first round: CLT (3) 1, SPR (6) 2.
    const s = first.series[0]
    expect(seriesStanding(s, 2)).toEqual({ kind: 'wins', teamId: s.winnerTeamId, score: '2–1' })
    expect(seriesStanding({ top: { teamId: 1, wins: 1 }, bottom: { teamId: 2, wins: 2 } }, 4)).toEqual({ kind: 'leads', teamId: 2, score: '2–1' })
    expect(seriesStanding({ top: { teamId: 1, wins: 0 }, bottom: { teamId: 2, wins: 0 } }, 4)).toEqual({ kind: 'tied', teamId: null, score: '0–0' })
  })

  it('marks overtime and shootout finals', () => {
    expect(['Final OT', 'Final 2OT', 'Final SO', 'Final', null].map(gameSuffix)).toEqual(['OT', '2OT', 'SO', '', ''])
  })
})

describe('currentPlayoffSeason', () => {
  it('is the playoffs paired with the current regular season, or the current playoffs', () => {
    const config = { currentSeason: 94, isPlayoffSeason: id => id === 92 || id === 95, playoffSeasonMap: { 94: 95 } }
    expect(currentPlayoffSeason(config)).toBe(95)
    expect(currentPlayoffSeason({ ...config, currentSeason: 92 })).toBe(92)
    expect(currentPlayoffSeason({ ...config, playoffSeasonMap: {} })).toBeNull()
    expect(currentPlayoffSeason(AHL.config)).not.toBeUndefined()
  })
})
