// src/utils/__tests__/hockeyTechPenalty.test.js
// PWHL/AHL/ECHL (HockeyTech) penalties in the PWHL period and game
// summaries, the PWHL penalties drill-down and the three leagues' power-play
// popups. A bench penalty's takenBy names no one -- id null, names '' -- and
// the PWHL summary joined those into '' and showed "Unknown": PWHL game 212
// (2025-11-22), P1 10:45, OTT "Too Many Players", served by Fanuza Kadirova.
//
// Fixtures are the events as the Worker returned them on 2026-10-05
// (/pwhl|ahl|echl/live/:gameId and /pwhl/pbp?gameId=).

import { describe, it, expect } from 'vitest'
import i18n from '../../i18n'
import { hockeyTechPenaltyParties, hockeyTechRowPenaltyParties } from '../hockeyTechPenalty.js'
import { penaltyHeadline, penaltyServedBy, summaryPenaltyLines } from '../penaltyText.js'
import { pwhlSummaryPenalty } from '../../hooks/usePWHLPeriodSummary.js'

const tEn = i18n.getFixedT('en')
const tFr = i18n.getFixedT('fr')

const OTT = 5

// PWHL 212, P1 10:45 -- OTT bench minor.
const pwhlTooManyPlayers = {
  eventType: 'penalty', period: 1, time: '10:45', timeSeconds: 645, teamId: OTT, teamAbbrev: 'OTT',
  takenBy:  { id: null, firstName: '', lastName: '', jerseyNumber: null },
  servedBy: { id: 240, firstName: 'Fanuza', lastName: 'Kadirova', jerseyNumber: 71 },
  minutes: 2, description: 'Too Many Players', isPowerPlay: false, isBench: true,
}
// PWHL 295 (2026-03-22), P1 7:14 -- MTL bench delay of game.
const pwhlBenchDelay = {
  eventType: 'penalty', period: 1, time: '7:14', timeSeconds: 434, teamId: 3, teamAbbrev: 'MTL',
  takenBy:  { id: null, firstName: '', lastName: '', jerseyNumber: null },
  servedBy: { id: 35, firstName: 'Jade', lastName: 'Downie-Landry', jerseyNumber: 77 },
  minutes: 2, description: 'Delay of Game', isPowerPlay: true, isBench: true,
}
// PWHL 226 (2025-12-16), P3 6:12 -- OTT goalie's minor, served by a skater.
const pwhlGoalieMinor = {
  eventType: 'penalty', period: 3, time: '6:12', timeSeconds: 372, teamId: OTT, teamAbbrev: 'OTT',
  takenBy:  { id: 222, firstName: 'Gwyneth', lastName: 'Philips', jerseyNumber: 33 },
  servedBy: { id: 239, firstName: 'Anna', lastName: 'Shokhina', jerseyNumber: 97 },
  minutes: 2, description: 'Tripping', isPowerPlay: true, isBench: false,
}
// PWHL 210, P1 15:49 -- an ordinary minor.
const pwhlHooking = {
  eventType: 'penalty', period: 1, time: '15:49', timeSeconds: 949, teamId: 6, teamAbbrev: 'TOR',
  takenBy:  { id: 63, firstName: 'Daryl', lastName: 'Watts', jerseyNumber: 9 },
  servedBy: { id: 63, firstName: 'Daryl', lastName: 'Watts', jerseyNumber: 9 },
  minutes: 2, description: 'Hooking', isPowerPlay: false, isBench: false,
}
// AHL 1027793, P2 11:03 -- CLE bench minor.
const ahlTooManyMen = {
  eventType: 'penalty', period: 2, time: '11:03', timeSeconds: 663, teamId: 373, teamAbbrev: 'CLE',
  takenBy:  { id: null, firstName: '', lastName: '', jerseyNumber: null },
  servedBy: { id: 9978, firstName: 'James', lastName: 'Malatesta', jerseyNumber: 11 },
  minutes: 2, description: 'Too many men - Bench minor', isPowerPlay: true, isBench: true,
}
// ECHL 24610, P3 8:20 -- ADK bench unsportsmanlike.
const echlBenchUnsportsmanlike = {
  eventType: 'penalty', period: 3, time: '8:20', timeSeconds: 500, teamId: 74, teamAbbrev: 'ADK',
  takenBy:  { id: null, firstName: '', lastName: '', jerseyNumber: null },
  servedBy: { id: 10813, firstName: 'Brian', lastName: 'Carrabes', jerseyNumber: 61 },
  minutes: 2, description: 'Bench minor - Unsportsmanlike conduct', isPowerPlay: true, isBench: true,
}

// The same penalties as stored PBP rows (/pwhl/pbp?gameId=).
const rowTooManyPlayers = {
  game_id: 212, event_type: 'penalty', period_id: 1, time_seconds: 645, team_id: OTT,
  player_id: 0, player_name: null, secondary_player_id: 240, secondary_player_name: 'Fanuza Kadirova',
  description: 'Too Many Players', is_power_play: false, is_bench_penalty: true, penalty_minutes: 2,
}
const rowMajor = {
  game_id: 212, event_type: 'penalty', period_id: 1, time_seconds: 677, team_id: 4,
  player_id: 47, player_name: 'Micah Zandee-Hart', secondary_player_id: 147, secondary_player_name: 'Savannah Norcross',
  description: 'Major-Cross Checking', is_power_play: true, is_bench_penalty: false, penalty_minutes: 5,
}
// A stored row the Worker didn't name: no name, but not a team penalty.
const rowUnnamed = {
  game_id: 210, event_type: 'penalty', period_id: 1, time_seconds: 949, team_id: 6,
  player_id: 63, player_name: null, secondary_player_id: 63, secondary_player_name: null,
  description: 'Hooking', is_power_play: false, is_bench_penalty: false, penalty_minutes: 2,
}

describe('hockeyTechPenaltyParties (live events)', () => {
  it('a bench penalty is a bench minor, served by a named skater', () => {
    expect(hockeyTechPenaltyParties(pwhlTooManyPlayers)).toEqual({
      committedName: null, servedByName: 'Fanuza Kadirova', teamPenalty: true, benchMinor: true,
    })
    expect(hockeyTechPenaltyParties(pwhlBenchDelay).benchMinor).toBe(true)
  })

  it('reads AHL and ECHL bench penalties the same way', () => {
    for (const ev of [ahlTooManyMen, echlBenchUnsportsmanlike]) {
      const parties = hockeyTechPenaltyParties(ev)
      expect(penaltyHeadline(parties, tEn)).toBe('Bench minor')
      expect(penaltyServedBy(parties, tEn)).toBe(`served by ${ev.servedBy.firstName} ${ev.servedBy.lastName}`)
    }
  })

  it('names who serves a player\'s penalty only when it is someone else', () => {
    expect(hockeyTechPenaltyParties(pwhlGoalieMinor)).toEqual({
      committedName: 'Gwyneth Philips', servedByName: 'Anna Shokhina', teamPenalty: false, benchMinor: false,
    })
    expect(hockeyTechPenaltyParties(pwhlHooking)).toEqual({
      committedName: 'Daryl Watts', servedByName: null, teamPenalty: false, benchMinor: false,
    })
  })

  it('a bench penalty longer than a minor is a team penalty', () => {
    const parties = hockeyTechPenaltyParties({ ...pwhlTooManyPlayers, minutes: 5 })
    expect(parties.benchMinor).toBe(false)
    expect(penaltyHeadline(parties, tEn)).toBe('Team penalty')
  })

  it('never invents a name', () => {
    const parties = hockeyTechPenaltyParties({ ...pwhlTooManyPlayers, servedBy: null })
    expect(penaltyHeadline(parties, tEn)).toBe('Bench minor')
    expect(penaltyServedBy(parties, tEn)).toBeNull()
    // A player the feed has an id for but no name: not a team penalty.
    const unnamed = hockeyTechPenaltyParties({ ...pwhlHooking, takenBy: { id: 63, firstName: '', lastName: '' } })
    expect(unnamed.teamPenalty).toBe(false)
    expect(penaltyHeadline(unnamed, tEn)).toBeNull()
  })
})

describe('hockeyTechRowPenaltyParties (stored PBP rows)', () => {
  it('player_id 0 with is_bench_penalty is a bench minor', () => {
    expect(hockeyTechRowPenaltyParties(rowTooManyPlayers)).toEqual({
      committedName: null, servedByName: 'Fanuza Kadirova', teamPenalty: true, benchMinor: true,
    })
  })

  it('a major served by a teammate', () => {
    expect(hockeyTechRowPenaltyParties(rowMajor)).toEqual({
      committedName: 'Micah Zandee-Hart', servedByName: 'Savannah Norcross', teamPenalty: false, benchMinor: false,
    })
  })

  it('an unnamed player is neither named nor a team penalty', () => {
    const parties = hockeyTechRowPenaltyParties(rowUnnamed)
    expect(parties.teamPenalty).toBe(false)
    expect(penaltyHeadline(parties, tEn)).toBeNull()
  })

  it('reads a live event normalized to the row shape (PWHLShotMapView)', () => {
    const normalized = {
      player_id: null, player_name: '', secondary_player_id: 240, secondary_player_name: 'Fanuza Kadirova',
      is_bench_penalty: true, penalty_minutes: 2,
    }
    expect(penaltyHeadline(hockeyTechRowPenaltyParties(normalized), tEn)).toBe('Bench minor')
  })
})

describe('PWHL summary penalty rows', () => {
  it('a bench minor reads "Bench minor", not "Unknown"', () => {
    const p = pwhlSummaryPenalty(pwhlTooManyPlayers, OTT)
    expect(p).toMatchObject({
      period: 1, time: '10:45', isCar: true, playerName: null, servedByName: 'Fanuza Kadirova',
      teamPenalty: true, benchMinor: true, type: 'Too Many Players', duration: 2,
    })
    expect(summaryPenaltyLines(p, tEn, { typeIsText: true })).toEqual({
      who: 'Bench minor', what: 'Too Many Players · 2 min · served by Fanuza Kadirova · P1',
    })
    expect(summaryPenaltyLines(p, tFr, { typeIsText: true })).toEqual({
      who: 'Mineure de banc', what: 'Too Many Players · 2 min · purgée par Fanuza Kadirova · P1',
    })
  })

  it('keeps HockeyTech\'s own description text', () => {
    const p = pwhlSummaryPenalty({ ...pwhlGoalieMinor, description: 'Major - Check to the Head', minutes: 5 }, 1)
    expect(summaryPenaltyLines(p, tEn, { typeIsText: true })).toEqual({
      who: 'Gwyneth Philips', what: 'Major - Check to the Head · 5 min · served by Anna Shokhina · P3',
    })
  })

  it('a player\'s own minor', () => {
    const p = pwhlSummaryPenalty(pwhlHooking, OTT)
    expect(p.isCar).toBe(false)
    expect(summaryPenaltyLines(p, tEn, { typeIsText: true })).toEqual({
      who: 'Daryl Watts', what: 'Hooking · 2 min · P1',
    })
  })

  it('no description falls back to the translated "Penalty"', () => {
    const p = pwhlSummaryPenalty({ ...pwhlHooking, description: null }, OTT)
    expect(summaryPenaltyLines(p, tFr, { typeIsText: true }).what).toBe('Pénalité · 2 min · P1')
  })
})
