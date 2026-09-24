// src/utils/__tests__/gameTeam.test.js
// The game view's helpers answer from the side of whichever team it's
// watching from -- the favorite by default, or a guest team when a
// Scoreboard game is opened as someone else (see GameTeamContext.jsx).
// Outside these tests the favorite is whatever localStorage holds; under
// Node there's no localStorage, so it's the CAR default.

import { describe, it, expect, vi, afterEach } from 'vitest'
import {
  getOpponent, isHomeGame, getCarScore, getOppScore, extractShotEvents, getLiveGame, TEAM_CONFIG,
} from '../nhlApi.js'
import { getTeamByAbbr } from '../teamConfig.js'

const BOS = getTeamByAbbr('BOS')
const TOR = getTeamByAbbr('TOR')

// BOS at TOR, 2-1 Toronto.
const game = {
  id: 2025020001,
  homeTeam: { abbrev: 'TOR', id: TOR.teamId, score: 2 },
  awayTeam: { abbrev: 'BOS', id: BOS.teamId, score: 1 },
}

describe('game helpers, from a guest team’s side', () => {
  it('is the favorite by default', () => {
    expect(TEAM_CONFIG.abbr).toBe('CAR')
  })

  it('answers the same game from either team', () => {
    expect(getOpponent(game, BOS).abbrev).toBe('TOR')
    expect(getOpponent(game, TOR).abbrev).toBe('BOS')
    expect(isHomeGame(game, BOS)).toBe(false)
    expect(isHomeGame(game, TOR)).toBe(true)
    expect([getCarScore(game, BOS), getOppScore(game, BOS)]).toEqual([1, 2])
    expect([getCarScore(game, TOR), getOppScore(game, TOR)]).toEqual([2, 1])
  })

  it('marks the watched team’s shots as the rink’s own', () => {
    const pbp = {
      rosterSpots: [],
      plays: [
        { eventId: 1, typeDescKey: 'shot-on-goal', details: { xCoord: 60, yCoord: 5, eventOwnerTeamId: BOS.teamId } },
        { eventId: 2, typeDescKey: 'shot-on-goal', details: { xCoord: -60, yCoord: 5, eventOwnerTeamId: TOR.teamId } },
      ],
    }
    expect(extractShotEvents(pbp, BOS).map(e => e.isCanes)).toEqual([true, false])
    expect(extractShotEvents(pbp, TOR).map(e => e.isCanes)).toEqual([false, true])
  })
})

describe('getLiveGame', () => {
  afterEach(() => vi.unstubAllGlobals())

  // The live hold remembers the last live game it saw so one empty read
  // doesn't drop the view out of live mode. Shared across teams, it would
  // hand the guest team's live game to the favorite's view.
  it('keeps each team’s live game to that team', async () => {
    const bosLive = { ...game, gameState: 'LIVE' }
    vi.stubGlobal('window', { location: { search: '' } })
    // A Worker KV miss (404), then the NHL schedule itself.
    vi.stubGlobal('fetch', vi.fn(async (url) => String(url).includes('/cache/')
      ? { ok: false, status: 404 }
      : { ok: true, json: async () => ({ games: String(url).includes('/club-schedule-season/BOS/') ? [bosLive] : [] }) }))

    expect(await getLiveGame(BOS)).toEqual(bosLive)
    expect(await getLiveGame(TEAM_CONFIG)).toBeNull()
  })
})
