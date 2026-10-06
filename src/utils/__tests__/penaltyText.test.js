// src/utils/__tests__/penaltyText.test.js
// Penalty text in the period summary, Recent Events, the penalties drill-down
// and the power-play popup. A bench minor has no committedByPlayerId -- only
// servedByPlayerId -- and the period summary showed it as "Unknown" with the
// raw descKey: BOS-CAR 2026-04-07 (2025021237), P1 17:25, CAR's failed
// challenge read "Unknown | Delaying-Game-Unsuccessful-Challenge · 2 Min".

import { describe, it, expect } from 'vitest'
import i18n from '../../i18n'
import en from '../../i18n/locales/en.json'
import fr from '../../i18n/locales/fr.json'
import {
  penaltyParties, penaltyHeadline, penaltyServedBy, penaltyDescription, summaryPenaltyLines,
} from '../penaltyText.js'
import { summaryPenalty } from '../../hooks/usePeriodSummary.js'

const tEn = i18n.getFixedT('en')
const tFr = i18n.getFixedT('fr')

const CAR = 12
const BOS = 6
const roster = { 8475791: 'Taylor Hall', 8480355: 'Jeremy Swayman', 8477507: 'Mark Kastelic', 8481219: 'Seth Jarvis' }
const nameOf = id => roster[id] || null

// The plays as the NHL's play-by-play has them for 2025021237.
const failedChallenge = {
  typeDescKey: 'penalty', timeInPeriod: '17:25', periodDescriptor: { number: 1 },
  details: { typeCode: 'BEN', descKey: 'delaying-game-unsuccessful-challenge', duration: 2, servedByPlayerId: 8475791, eventOwnerTeamId: CAR },
}
const goalieInterference = {
  typeDescKey: 'penalty', timeInPeriod: '20:00', periodDescriptor: { number: 1 },
  details: { typeCode: 'MIN', descKey: 'interference-goalkeeper', duration: 2, committedByPlayerId: 8480355, drawnByPlayerId: 8481219, eventOwnerTeamId: BOS },
}

describe('penaltyParties', () => {
  it('a bench minor is a team penalty, served by a named skater', () => {
    expect(penaltyParties(failedChallenge.details, nameOf)).toEqual({
      committedName: null, servedByName: 'Taylor Hall', teamPenalty: true, benchMinor: true,
    })
  })

  it("a player's own penalty names the player", () => {
    expect(penaltyParties(goalieInterference.details, nameOf)).toEqual({
      committedName: 'Jeremy Swayman', servedByName: null, teamPenalty: false, benchMinor: false,
    })
  })

  it("a goalie's minor served by a skater names both", () => {
    const d = { typeCode: 'MIN', descKey: 'tripping', duration: 2, committedByPlayerId: 8480355, servedByPlayerId: 8477507 }
    expect(penaltyParties(d, nameOf)).toMatchObject({ committedName: 'Jeremy Swayman', servedByName: 'Mark Kastelic' })
  })

  it('never invents a name the roster does not have', () => {
    const d = { typeCode: 'BEN', descKey: 'too-many-men-on-the-ice', duration: 2, servedByPlayerId: 999 }
    expect(penaltyParties(d, nameOf)).toMatchObject({ committedName: null, servedByName: null })
    expect(penaltyParties({ committedByPlayerId: 999 }, nameOf)).toMatchObject({ committedName: null, teamPenalty: false })
  })

  it('does not repeat the player as serving their own penalty', () => {
    expect(penaltyParties({ committedByPlayerId: 8475791, servedByPlayerId: 8475791 }, nameOf).servedByName).toBeNull()
  })
})

describe('penaltyHeadline / penaltyServedBy', () => {
  it('labels a bench minor and who serves it', () => {
    const p = penaltyParties(failedChallenge.details, nameOf)
    expect(penaltyHeadline(p, tEn)).toBe('Bench minor')
    expect(penaltyServedBy(p, tEn)).toBe('served by Taylor Hall')
    expect(penaltyHeadline(p, tFr)).toBe('Mineure de banc')
    expect(penaltyServedBy(p, tFr)).toBe('purgée par Taylor Hall')
  })

  it('a team penalty that is not a bench minor says so', () => {
    const p = penaltyParties({ typeCode: 'MIN', descKey: 'delaying-game' }, nameOf)
    expect(penaltyHeadline(p, tEn)).toBe('Team penalty')
  })

  it('returns null for a player the roster cannot name, so the caller decides', () => {
    expect(penaltyHeadline(penaltyParties({ committedByPlayerId: 999 }, nameOf), tEn)).toBeNull()
  })
})

describe('penaltyDescription', () => {
  it('reads descKeys as words', () => {
    expect(penaltyDescription('delaying-game-unsuccessful-challenge', tEn)).toBe('Delay of game (unsuccessful challenge)')
    expect(penaltyDescription('interference-goalkeeper', tEn)).toBe('Goaltender interference')
    expect(penaltyDescription('too-many-men-on-the-ice', tEn)).toBe('Too many men on the ice')
    expect(penaltyDescription('delaying-game-unsuccessful-challenge', tFr)).toBe('Retarder le match (contestation infructueuse)')
  })

  it('a descKey with no translation reads as its own words', () => {
    expect(penaltyDescription('some-new-infraction', tEn)).toBe('Some new infraction')
    expect(penaltyDescription('odd.key', tEn)).toBe('Odd.key')
  })

  it('no descKey, no description', () => {
    expect(penaltyDescription(undefined, tEn)).toBeNull()
    expect(penaltyDescription('', tEn)).toBeNull()
  })

  it('every translated descKey exists in both locales', () => {
    expect(Object.keys(fr.penalties.desc).sort()).toEqual(Object.keys(en.penalties.desc).sort())
    expect(Object.keys(fr.penalties).sort()).toEqual(Object.keys(en.penalties).sort())
  })
})

describe('summaryPenalty + summaryPenaltyLines', () => {
  it('the failed challenge reads as a served bench minor, not "Unknown"', () => {
    const row = summaryPenalty(failedChallenge, roster, CAR)
    expect(row).toMatchObject({
      isCar: true, playerName: null, servedByName: 'Taylor Hall', teamPenalty: true, benchMinor: true, typeCode: 'BEN',
    })
    expect(summaryPenaltyLines(row, tEn)).toEqual({
      who: 'Bench minor',
      what: 'Delay of game (unsuccessful challenge) · 2 min · served by Taylor Hall',
    })
  })

  it("a player's penalty reads as before, with the game summary's period", () => {
    const row = { period: 1, ...summaryPenalty(goalieInterference, roster, CAR) }
    expect(row).toMatchObject({ isCar: false, playerName: 'Jeremy Swayman', drawnByName: 'Seth Jarvis' })
    expect(summaryPenaltyLines(row, tEn)).toEqual({ who: 'Jeremy Swayman', what: 'Goaltender interference · 2 min · P1' })
  })

  it('a row stored before this change, with no name, still says Unknown', () => {
    const old = { isCar: true, type: 'hooking', duration: 2, playerName: null }
    expect(summaryPenaltyLines(old, tEn)).toEqual({ who: 'Unknown', what: 'Hooking · 2 min' })
  })
})
