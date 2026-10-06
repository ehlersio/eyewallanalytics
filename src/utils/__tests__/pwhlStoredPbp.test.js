// src/utils/__tests__/pwhlStoredPbp.test.js
// A finished PWHL game's period and game summaries come from the stored
// play-by-play (/pwhl/pbp), which the summary code didn't read -- it only
// knew the live feed's shape, so a finished game never got a summary.
// pwhlStoredPbp.js turns the rows into the live shape; these tests build
// both from the same games, as the Worker returned them (fixtures/), and
// compare.
//
//   game 212, 2025-11-22, NY 4 @ OTT 0 -- a bench minor (OTT too many
//     players, served by Fanuza Kadirova), a major + game misconduct
//   game 233, 2025-12-21, OTT 3 @ BOS 2 -- decided in overtime (period 4)

import { describe, it, expect } from 'vitest'
import { pwhlEventsFromStoredPBP, pwhlSummaryPlayerNames, hockeyTechClock } from '../pwhlStoredPbp.js'
import {
  pwhlSummaryEvents, buildPWHLSummary, buildPWHLGameSummary, computePWHLShotStats,
} from '../../hooks/usePWHLPeriodSummary.js'

import pbp212 from './fixtures/pwhl-game-212/pbp.json'
import live212 from './fixtures/pwhl-game-212/live.json'
import summary212 from './fixtures/pwhl-game-212/summary.json'
import pbp233 from './fixtures/pwhl-game-233/pbp.json'
import live233 from './fixtures/pwhl-game-233/live.json'
import summary233 from './fixtures/pwhl-game-233/summary.json'

const OTT = 5
const NY  = 4
const BOS = 2

// fetchPWHLPBP's shape (pwhlApi.js).
const asFetched = (raw, gameId) => ({
  gameId,
  events:       raw.events,
  oppShots:     raw.opp_shots,
  homeTeamId:   raw.home_team_id,
  awayTeamId:   raw.away_team_id,
  faceoffStats: raw.faceoff_stats,
  goalieStats:  raw.goalie_stats,
})

const liveEvents = (live, teamId, htSummary) =>
  pwhlSummaryEvents({ isLive: true, liveData: live, teamId, gameId: live.gameId, htSummary })
const storedEvents = (pbp, gameId, teamId, htSummary) =>
  pwhlSummaryEvents({ isLive: false, pbpData: asFetched(pbp, gameId), teamId, gameId, htSummary })

// Everything but the build time.
const comparable = ({ generatedAt: _generatedAt, ...rest }) => rest
const count = (events, type) => events.filter(e => e.eventType === type).length

describe('hockeyTechClock', () => {
  it('writes seconds as the live feed does', () => {
    expect(hockeyTechClock(0)).toBe('0:00')
    expect(hockeyTechClock(11)).toBe('0:11')
    expect(hockeyTechClock(645)).toBe('10:45')
    expect(hockeyTechClock(1196)).toBe('19:56')
  })

  it('no seconds, no clock', () => {
    expect(hockeyTechClock(null)).toBeNull()
    expect(hockeyTechClock(undefined)).toBeNull()
  })
})

describe('pwhlEventsFromStoredPBP (game 212)', () => {
  const events = pwhlEventsFromStoredPBP(asFetched(pbp212, 212))

  it('has the rows\' hits, faceoffs and penalties, and every shot from the shot rows', () => {
    expect(count(events, 'hit')).toBe(57)
    expect(count(events, 'faceoff')).toBe(55)
    expect(count(events, 'penalty')).toBe(8)
    expect(count(events, 'blocked_shot')).toBe(25)
    // 65 shot rows + the 4 goals, which the live feed also sends as shots.
    expect(count(events, 'shot')).toBe(69)
    expect(events.filter(e => e.eventType === 'shot' && e.isGoal)).toHaveLength(4)
    expect(count(events, 'goal')).toBe(4)
  })

  it('is in time order, a goal right after its shot', () => {
    const keys = events.map(e => e.period * 10000 + e.timeSeconds)
    expect(keys).toEqual([...keys].sort((a, b) => a - b))
    const firstGoal = events.findIndex(e => e.eventType === 'goal')
    expect(events[firstGoal - 1]).toMatchObject({ eventType: 'shot', isGoal: true, period: 3, time: '7:49', teamId: NY })
  })

  it('a faceoff\'s winner (team_id) becomes homeWin', () => {
    // P1 0:00: NY (away) won the opening draw.
    expect(events.find(e => e.eventType === 'faceoff')).toMatchObject({ period: 1, time: '0:00', teamId: NY, homeWin: false })
    const live = live212.events.filter(e => e.eventType === 'faceoff').map(e => e.homeWin)
    expect(events.filter(e => e.eventType === 'faceoff').map(e => e.homeWin)).toEqual(live)
  })

  it('the bench minor names no one and is served by Kadirova', () => {
    const bench = events.find(e => e.eventType === 'penalty' && e.isBench)
    expect(bench).toMatchObject({ period: 1, time: '10:45', teamId: OTT, description: 'Too Many Players', minutes: 2 })
    expect(bench.parties).toEqual({
      committedName: null, servedByName: 'Fanuza Kadirova', teamPenalty: true, benchMinor: true,
    })
  })

  it('the raw /pwhl/pbp body reads the same', () => {
    expect(pwhlEventsFromStoredPBP(pbp212)).toEqual(events)
  })

  it('nothing to read, nothing out', () => {
    expect(pwhlEventsFromStoredPBP(null)).toEqual([])
    expect(pwhlEventsFromStoredPBP({ events: [] })).toEqual([])
  })
})

describe('names the stored rows are missing', () => {
  const penalty = (events, time) => events.find(e => e.eventType === 'penalty' && e.time === time)

  it('come only from the same game, by player id', () => {
    const events = pwhlEventsFromStoredPBP(asFetched(pbp212, 212), pwhlSummaryPlayerNames(summary212))
    // Maddi Wheeler (285): no row names her; /pwhl/summary's assists do.
    expect(penalty(events, '12:51').parties.committedName).toBe('Maddi Wheeler')
    // Kristin O'Neill (30): the faceoff line does.
    expect(penalty(events, '0:11').parties.committedName).toBe("Kristin O'Neill")
    // Allyson Simpson (230): named nowhere in the stored game, so no name.
    expect(penalty(events, '19:20').parties.committedName).toBeNull()
    // Taylor Girard (9) scored with shooter_name null; the summary names her.
    expect(events.find(e => e.eventType === 'goal').scorerName).toBe('Taylor Girard')
  })

  it('without the game summary, stay missing', () => {
    const events = pwhlEventsFromStoredPBP(asFetched(pbp212, 212))
    expect(penalty(events, '12:51').parties.committedName).toBeNull()
    expect(events.find(e => e.eventType === 'goal').scorerName).toBeNull()
  })

  it('pwhlSummaryPlayerNames reads scorers, assists, stars and goalies', () => {
    const names = pwhlSummaryPlayerNames(summary212)
    expect(names[9]).toBe('Taylor Girard')
    expect(names[285]).toBe('Maddi Wheeler')
    expect(names[222]).toBe('Gwyneth Philips')
    expect(pwhlSummaryPlayerNames(null)).toEqual({})
  })
})

describe('shots on goal', () => {
  // HockeyTech's own per-period shot totals (/pwhl/summary).
  const official = (summary, homeTeamId, teamId) => summary.periods.map(p =>
    teamId === homeTeamId ? p.stats.homeShots : p.stats.visitingShots)
  const perPeriod = (events, teamId, periods) => periods.map(p => computePWHLShotStats(events, teamId, p).carSOG)

  it('live: every shot event counts, goals once (game 212)', () => {
    for (const teamId of [OTT, NY]) {
      expect(perPeriod(liveEvents(live212, teamId), teamId, [1, 2, 3])).toEqual(official(summary212, OTT, teamId))
    }
  })

  it('live and stored match HockeyTech\'s totals in an OT game (game 233)', () => {
    for (const teamId of [BOS, OTT]) {
      const want = official(summary233, BOS, teamId)
      expect(perPeriod(liveEvents(live233, teamId), teamId, [1, 2, 3, 4])).toEqual(want)
      expect(perPeriod(storedEvents(pbp233, 233, teamId), teamId, [1, 2, 3, 4])).toEqual(want)
    }
  })
})

describe('a finished game\'s summaries match the live ones', () => {
  it('game 233 (OT): every period and the game, for both teams', () => {
    for (const teamId of [BOS, OTT]) {
      const live   = liveEvents(live233, teamId, summary233)
      const stored = storedEvents(pbp233, 233, teamId, summary233)
      for (const period of [1, 2, 3, 4]) {
        expect(comparable(buildPWHLSummary(period, stored, teamId, summary233, 233)))
          .toEqual(comparable(buildPWHLSummary(period, live, teamId, summary233, 233)))
      }
      expect(comparable(buildPWHLGameSummary(stored, teamId, summary233, 233)))
        .toEqual(comparable(buildPWHLGameSummary(live, teamId, summary233, 233)))
    }
    const ot = buildPWHLSummary(4, storedEvents(pbp233, 233, OTT, summary233), OTT, summary233, 233)
    expect(ot).toMatchObject({ periodShort: 'OT', carGoals: 1, oppGoals: 0, homeScore: 2, awayScore: 3 })
    expect(ot.goals[0]).toMatchObject({ isCar: true, period: 4, time: '3:55', scorerName: 'Sarah Wozniewicz' })
  })

  describe('game 212, from Ottawa\'s side', () => {
    const live   = liveEvents(live212, OTT, summary212)
    const stored = storedEvents(pbp212, 212, OTT, summary212)
    const liveGame   = buildPWHLGameSummary(live, OTT, summary212, 212)
    const storedGame = buildPWHLGameSummary(stored, OTT, summary212, 212)

    it('period scores, goals, faceoffs and hits', () => {
      for (const period of [1, 2, 3]) {
        const a = buildPWHLSummary(period, live, OTT, summary212, 212)
        const b = buildPWHLSummary(period, stored, OTT, summary212, 212)
        for (const key of ['periodShort', 'homeScore', 'awayScore', 'carGoals', 'oppGoals', 'goals', 'carFOPct', 'carHits', 'threeStars', 'goalieNames']) {
          expect(b[key], `P${period} ${key}`).toEqual(a[key])
        }
      }
      expect(storedGame.goals).toEqual(liveGame.goals)
      expect(storedGame.goals.map(g => g.scorerName)).toEqual(['Taylor Girard', 'Taylor Girard', 'Taylor Girard', 'Maja Nylén Persson'])
      expect(storedGame).toMatchObject({ homeScore: 0, awayScore: 4, carGoals: 0, oppGoals: 4, carHits: liveGame.carHits, carFOPct: liveGame.carFOPct })
    })

    it('penalties, the bench minor included; one player the stored game never names', () => {
      expect(storedGame.penalties).toHaveLength(8)
      const unnamed = storedGame.penalties.filter(p => !p.playerName && !p.teamPenalty)
      expect(unnamed).toEqual([{ ...liveGame.penalties[7], playerName: null }])
      expect(liveGame.penalties[7]).toMatchObject({ time: '19:20', playerName: 'Allyson Simpson' })
      expect(storedGame.penalties.slice(0, 7)).toEqual(liveGame.penalties.slice(0, 7))
      expect(storedGame.penalties[1]).toMatchObject({
        period: 1, time: '10:45', isCar: true, playerName: null, servedByName: 'Fanuza Kadirova',
        teamPenalty: true, benchMinor: true, type: 'Too Many Players', duration: 2,
      })
    })

    it('shots: the same, but for one P3 shot the stored rows lack', () => {
      // Wheeler shot twice at P3 7:46; the stored rows keep one (they were
      // written before eyewall-pipeline's dedup key included the location).
      const wheeler = e => e.eventType === 'shot' && e.period === 3 && e.time === '7:46'
      expect(live.filter(wheeler)).toHaveLength(2)
      expect(stored.filter(wheeler)).toHaveLength(1)
      expect(storedGame.periodStats.slice(0, 2)).toEqual(liveGame.periodStats.slice(0, 2))
      expect(storedGame).toMatchObject({ carSOG: 28, oppSOG: 41, carCorsi: liveGame.carCorsi, oppCorsi: liveGame.oppCorsi - 1 })
      expect(liveGame).toMatchObject({ carSOG: 28, oppSOG: 42 })
    })
  })

  it('without /pwhl/summary, a stored goal has no assists or strength to show', () => {
    const game = buildPWHLGameSummary(storedEvents(pbp212, 212, NY), NY, null, 212)
    expect(game.goals.map(g => g.strength)).toEqual([null, null, null, null])
    expect(game.goals.every(g => g.assists.length === 0)).toBe(true)
    // Nylén Persson's row names her; Girard's rows don't.
    expect(game.goals.map(g => g.scorerName)).toEqual([null, null, null, 'Maja Nylén Persson'])
  })

  it('a live goal without /pwhl/summary keeps its own assists and strength', () => {
    const game = buildPWHLGameSummary(liveEvents(live212, NY), NY, null, 212)
    expect(game.goals[0]).toMatchObject({ scorerName: 'Taylor Girard', strength: 'ev', assists: [{ name: { default: 'Maddi Wheeler' } }] })
    expect(game.goals[3].strength).toBe('sh')
  })

  it('rows for another game (the last one picked, still loading) build nothing', () => {
    expect(pwhlSummaryEvents({ isLive: false, pbpData: asFetched(pbp212, 212), teamId: OTT, gameId: 233 })).toEqual([])
  })
})
