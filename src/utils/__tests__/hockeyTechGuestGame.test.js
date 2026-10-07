// src/utils/__tests__/hockeyTechGuestGame.test.js
// The AHL/ECHL guest game view: which team a link opens as, and the
// subtitle's side of the game.

import { describe, it, expect } from 'vitest'
import { guestGameLine, guestTeamFor } from '../hockeyTechGuestGame'
import { AHL } from '../hockeyTechLeagues'

const HER = 319
const TEX = 380
const liveGame = { gameId: 7, homeTeamId: HER, awayTeamId: TEX, status: 'live' }
const ended = { gameId: 7, homeTeamId: HER, awayTeamId: TEX, gameStatus: 'final', events: [] }

describe('guestTeamFor', () => {
  it('opens as the team ?as= names', () => {
    expect(guestTeamFor(AHL, 'TEX', null)).toMatchObject({ abbr: 'TEX', teamId: TEX })
  })

  it('opens as the home team without ?as=', () => {
    expect(guestTeamFor(AHL, null, { homeTeamId: HER, awayTeamId: TEX })).toMatchObject({ abbr: 'HER' })
  })

  it('has no team for a link it can’t open', () => {
    expect(guestTeamFor(AHL, 'XYZ', null)).toBeNull()
    expect(guestTeamFor(AHL, null, null)).toBeNull()
    expect(guestTeamFor(AHL, null, { homeTeamId: null })).toBeNull()
  })
})

describe('guestGameLine', () => {
  it('reads a live game from either side', () => {
    expect(guestGameLine(HER, { liveGame })).toEqual({ state: 'live', isHome: true, oppId: TEX, endedIn: null })
    expect(guestGameLine(TEX, { liveGame })).toEqual({ state: 'live', isHome: false, oppId: HER, endedIn: null })
  })

  it('reads the ended game once it’s final, not before', () => {
    expect(guestGameLine(TEX, { liveGame: null, ended })).toEqual({ state: 'final', isHome: false, oppId: HER, endedIn: null })
    expect(guestGameLine(TEX, { liveGame: null, ended: { ...ended, endedIn: 'SO' } }).endedIn).toBe('SO')
    expect(guestGameLine(TEX, { liveGame: null, ended: { ...ended, gameStatus: 'live' } })).toBeNull()
  })

  it('says nothing without a game, or for a team not in it', () => {
    expect(guestGameLine(TEX, { liveGame: null, ended: null })).toBeNull()
    expect(guestGameLine(1, { liveGame })).toBeNull()
    expect(guestGameLine(null, { liveGame })).toBeNull()
  })
})
