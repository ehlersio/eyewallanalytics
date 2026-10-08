// src/utils/__tests__/hockeyTechSummary.test.js
// AHL/ECHL period and final summaries (contract C8), built from a real
// game: AHL 1029081, CLT 5 at HER 2 on 2026-10-03, its Worker /ahl/live/
// and /ahl/summary answers saved 2026-10-07. The numbers below are that
// game's own: HockeyTech's per-period shots (12-10, 9-7, 11-12 for HER),
// Petersen's box score (28 SA, 24 SV), the PP lines (HER 0/2, CLT 0/1).

import { describe, it, expect } from 'vitest'
import live from './fixtures/ahl-game-1029081/live.json'
import htSummary from './fixtures/ahl-game-1029081/summary.json'
import {
  buildHockeyTechSummary, buildHockeyTechGameSummary, hockeyTechNarrativePayload, htBestWorstPeriods,
  htEndedIn, htGoalieLines, htPeriodShort, htShotStats, summaryPeriods,
} from '../hockeyTechSummary'
import { hockeyTechNarrativeCacheKey, hockeyTechNarrativePeriodKey } from '../narrativeCache'

const HER = 319, CLT = 384
const args = teamId => ({ events: live.events, teamId, htSummary, gameId: 1029081, homeTeamId: live.homeTeamId, headshotSize: '240x240' })

describe('periods', () => {
  it('lists the periods played, the shootout left out', () => {
    expect(summaryPeriods(live.events)).toEqual([1, 2, 3])
    const so = [...live.events, { eventType: 'shot', period: 4, teamId: HER }, { eventType: 'shootout', period: 7 }]
    expect(summaryPeriods(so)).toEqual([1, 2, 3, 4])
    expect(htEndedIn(live.events)).toBeNull()
    expect(htEndedIn(so)).toBe('SO')
    expect(htEndedIn([...live.events, { eventType: 'goal', period: 4 }])).toBe('OT')
    expect([1, 3, 4, 5].map(htPeriodShort)).toEqual(['P1', 'P3', 'OT', '2OT'])
  })

  it('counts each period’s shots on goal as HockeyTech does', () => {
    expect(htShotStats(live.events, HER, 1)).toMatchObject({ carSOG: 12, oppSOG: 10 })
    expect(htShotStats(live.events, HER, 3)).toMatchObject({ carSOG: 11, oppSOG: 12 })
    expect(htShotStats(live.events, CLT)).toMatchObject({ carSOG: 29, oppSOG: 32 })
  })
})

describe('goalie lines', () => {
  it('match the box score, the empty-net goal against no one', () => {
    const lines = htGoalieLines(live.events, HER)
    expect(lines[0]).toEqual({ name: 'Cal Petersen', isCar: true, shots: 28, goalsAgainst: 4, saves: 24 })
    expect(lines.at(-1)).toMatchObject({ isCar: false, goalsAgainst: 2 })
    // From the other side, the other team's goalie comes first.
    expect(htGoalieLines(live.events, CLT)[0].isCar).toBe(true)
    expect(htGoalieLines(live.events, CLT)[0].name).not.toBe('Cal Petersen')
  })
})

describe('buildHockeyTechSummary', () => {
  it('builds a period from the followed team’s side', () => {
    const s = buildHockeyTechSummary(3, args(HER))
    expect(s).toMatchObject({
      period: 3, periodLabel: 'Period 3', periodShort: 'P3', isGameSummary: false,
      carSOG: 11, oppSOG: 12, carGoals: 0, oppGoals: 3, isHome: true, carScore: 2, oppScore: 5,
      goalieNames: ['Cal Petersen'],
    })
    // The last period carries the three stars.
    expect(s.threeStars.map(x => x.name.default)).toContain('Nate Smith')
    expect(s.threeStars[0].headshot).toMatch(/^https:\/\//)
  })

  it('enriches goals from the summary and keeps the score through the period', () => {
    const s = buildHockeyTechSummary(1, args(CLT))
    expect(s).toMatchObject({ carScore: 1, oppScore: 1, isHome: false, threeStars: [] })
    const herGoal = s.goals.find(g => !g.isCar)
    expect(herGoal).toMatchObject({ scorerName: 'Josh Dunne', time: '3:08', strength: 'ev' })
    expect(herGoal.scorerHeadshot).toBe('https://assets.leaguestat.com/ahl/240x240/8641.jpg')
    expect(herGoal.assists.map(a => a.name.default)).toEqual(['Jonny Brodzinski', 'Andrew Cristall'])
    expect(s.penalties).toHaveLength(4)
  })
})

describe('buildHockeyTechGameSummary', () => {
  const g = buildHockeyTechGameSummary({ ...args(HER), homeScore: live.homeScore, awayScore: live.awayScore })

  it('has the final, scoring and shots by period, and the power play', () => {
    expect(g).toMatchObject({ period: 'game', periodLabel: 'Final', isGameSummary: true, carScore: 2, oppScore: 5, carSOG: 32, oppSOG: 29 })
    expect(g.periodStats.map(p => [p.periodShort, p.carGoals, p.oppGoals, p.carSOG, p.oppSOG]))
      .toEqual([['P1', 1, 1, 12, 10], ['P2', 1, 1, 9, 7], ['P3', 0, 3, 11, 12]])
    expect(g.powerPlay).toEqual({ carGoals: 0, carOpps: 2, oppGoals: 0, oppOpps: 1 })
    expect(g.threeStars).toHaveLength(3)
  })

  it('ranks the best and worst period by the shots-on-goal margin', () => {
    expect(g.bestPeriod).toEqual({ period: 1, carSOG: 12, oppSOG: 10 })
    expect(g.worstPeriod).toEqual({ period: 3, carSOG: 11, oppSOG: 12 })
    expect(htBestWorstPeriods([{ period: 1, carSOG: 0, oppSOG: 0 }])).toEqual({ bestPeriod: null, worstPeriod: null })
  })

  it('has no power play when the summary has none', () => {
    expect(buildHockeyTechGameSummary({ ...args(HER), htSummary: null }).powerPlay).toBeNull()
  })
})

describe('the narrative request', () => {
  it('sends the C8 keys: shots, not Corsi, hits or faceoffs', () => {
    const g = buildHockeyTechGameSummary({ ...args(HER), homeScore: 2, awayScore: 5 })
    const body = JSON.parse(JSON.stringify(hockeyTechNarrativePayload(g, { carAbbr: 'HER', oppAbbr: 'CLT', carName: 'Hershey Bears', oppName: 'Charlotte Checkers' })))
    expect(body).toMatchObject({ carAbbr: 'HER', carName: 'Hershey Bears', carSOG: 32, oppSOG: 29, bestPeriod: { period: 1, carSOG: 12, oppSOG: 10 }, penaltyCount: 13 })
    for (const k of ['corsiForPct', 'carHits', 'carFOPct', 'league']) expect(body).not.toHaveProperty(k)
    expect(body.goals[0]).toEqual({ isCar: true, scorerName: 'Josh Dunne', time: '3:08', period: 1, strength: 'ev' })
  })

  it('reads the Worker’s KV key: by team id and language, period 4 filed as OT', () => {
    expect(hockeyTechNarrativeCacheKey('ahl', 2, 1029081, HER)).toBe('ahl:narrative:2:1029081:319')
    expect(hockeyTechNarrativeCacheKey('echl', 'game', 24323, 74, 'fr')).toBe('echl:narrative:game:24323:74:fr')
    expect(hockeyTechNarrativeCacheKey('ahl', 4, 1, HER)).toBe(hockeyTechNarrativeCacheKey('ahl', 'OT', 1, HER))
    expect(['1', 4, 5, 6, 'ot', '2OT', 'game', 7, 0, null].map(hockeyTechNarrativePeriodKey))
      .toEqual(['1', 'OT', '2OT', '3OT', 'OT', '2OT', 'game', null, null, null])
    expect(hockeyTechNarrativeCacheKey('ahl', 7, 1, HER)).toBeNull()
    expect(hockeyTechNarrativeCacheKey('ahl', 1, 1, null)).toBeNull()
  })
})
