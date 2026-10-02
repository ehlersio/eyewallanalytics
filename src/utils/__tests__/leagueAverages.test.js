// src/utils/__tests__/leagueAverages.test.js
// League averages for the Team page's Advanced tab, from every team's NHL
// season totals -- weighted like the NHL's own team numbers.

import { describe, it, expect } from 'vitest'
import { leagueTeamAverages, teamShotAttempts } from '../leagueAverages.js'

// Carolina's real 2025-26 rows (NHL stats API team reports), trimmed
const CAR = {
  "summary": {
    "gamesPlayed": 82,
    "shotsForPerGame": 32.15853,
    "shotsAgainstPerGame": 23.92682,
    "goalsFor": 291,
    "goalsAgainst": 236,
    "powerPlayPct": 0.248962,
    "powerPlayNetPct": 0.232365,
    "penaltyKillPct": 0.805195,
    "penaltyKillNetPct": 0.857142
  },
  "realtime": {
    "gamesPlayed": 82,
    "totalShotAttempts": 5748,
    "satPct": 0.59125,
    "shots": 2637,
    "missedShots": 1529,
    "blockedShots": 928,
    "shotAttemptsBlocked": 1582
  },
  "powerplay": {
    "gamesPlayed": 82,
    "powerPlayGoalsFor": 60,
    "ppNetGoals": 56,
    "ppOpportunities": 241
  },
  "penaltykill": {
    "gamesPlayed": 82,
    "ppGoalsAgainst": 45,
    "shGoalsFor": 12,
    "timesShorthanded": 231
  }
}

describe('leagueTeamAverages', () => {
  it('reproduces the NHL\'s own team percentages from the totals (one team = that team)', () => {
    const a = leagueTeamAverages({ summary: [CAR.summary], realtime: [CAR.realtime], powerplay: [CAR.powerplay], penaltykill: [CAR.penaltykill] })
    expect(a.ppPct).toBeCloseTo(CAR.summary.powerPlayPct, 5)
    expect(a.netPpPct).toBeCloseTo(CAR.summary.powerPlayNetPct, 5)
    expect(a.pkPct).toBeCloseTo(CAR.summary.penaltyKillPct, 5)
    expect(a.netPkPct).toBeCloseTo(CAR.summary.penaltyKillNetPct, 5)
    expect(a.goalsForPerGame).toBeCloseTo(CAR.summary.goalsFor / 82, 6)
    expect(a.teams).toBe(1)
  })

  it('weights by totals, not by averaging the teams\' percentages', () => {
    const pp = [
      { powerPlayGoalsFor: 1, ppNetGoals: 1, ppOpportunities: 10 },   // 10%
      { powerPlayGoalsFor: 30, ppNetGoals: 28, ppOpportunities: 100 }, // 30%
    ]
    const summary = [
      { gamesPlayed: 10, shotsForPerGame: 30, shotsAgainstPerGame: 25, goalsFor: 30, goalsAgainst: 20 },
      { gamesPlayed: 30, shotsForPerGame: 20, shotsAgainstPerGame: 25, goalsFor: 60, goalsAgainst: 70 },
    ]
    const a = leagueTeamAverages({ summary, powerplay: pp })
    expect(a.ppPct).toBeCloseTo(31 / 110) // not (10% + 30%) / 2
    expect(a.shotsForPerGame).toBeCloseTo((300 + 600) / 40)
    expect(a.goalsForPerGame).toBeCloseTo(90 / 40)
    expect(a.shPct).toBeCloseTo(90 / 900)
    expect(a.svPct).toBeCloseTo(1 - 90 / 1000)
  })

  it('leaves out what it has no data for -- never a default', () => {
    const a = leagueTeamAverages({ summary: [CAR.summary] })
    expect(a.ppPct).toBeNull()
    expect(a.pkPct).toBeNull()
    expect(a.blockedForPerGame).toBeNull()
    expect(a.satForPerGame).toBeNull()
    expect(leagueTeamAverages({ summary: [] })).toBeNull()
    expect(leagueTeamAverages({ summary: undefined })).toBeNull()
  })
})

describe('teamShotAttempts', () => {
  it('takes Corsi from the realtime report: attempts for and CF%, attempts against derived', () => {
    const a = teamShotAttempts(CAR.realtime, 82)
    // totalShotAttempts is shots + missed + the team's own attempts that were blocked
    expect(CAR.realtime.totalShotAttempts).toBe(CAR.realtime.shots + CAR.realtime.missedShots + CAR.realtime.shotAttemptsBlocked)
    expect(a.corsiForPct).toBe(CAR.realtime.satPct)
    expect(a.satForPerGame).toBeCloseTo(CAR.realtime.totalShotAttempts / 82)
    expect(a.satFor / (a.satFor + a.satAgainst)).toBeCloseTo(CAR.realtime.satPct, 6)
  })

  it('is null without the fields it needs', () => {
    expect(teamShotAttempts(null, 82)).toBeNull()
    expect(teamShotAttempts({ totalShotAttempts: 10 }, 82)).toBeNull()
    expect(teamShotAttempts(CAR.realtime, 0)).toBeNull()
  })
})
