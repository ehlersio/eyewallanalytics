// src/utils/__tests__/nhlGameMath.test.js
// The NHL game view's numbers checked against the NHL's own totals for the
// same real games. fixtures/nhl-games/<gameId>.json holds the game's
// play-by-play and right-rail as api-web.nhle.com returned them on
// 2026-10-05 (trimmed to the fields read here).
import { describe, it, expect } from 'vitest'
import { computeShotAttempts } from '../advancedStats.js'
import { withoutShootout, hasShotTracking, nhlPeriodLabel } from '../gamePlays.js'
import { powerPlayRecord, powerPlayOpportunities, teamOnPowerPlay } from '../powerPlays.js'
import { summaryTeam } from '../summaryTeam.js'

import g2026020018 from './fixtures/nhl-games/2026020018.json'
import g2025020121 from './fixtures/nhl-games/2025020121.json'
import g2026010026 from './fixtures/nhl-games/2026010026.json'
import g2025030132 from './fixtures/nhl-games/2025030132.json'
import g2026010044 from './fixtures/nhl-games/2026010044.json'
import g2026020036 from './fixtures/nhl-games/2026020036.json'
import g2026020026 from './fixtures/nhl-games/2026020026.json'
import g2026020038 from './fixtures/nhl-games/2026020038.json'

const GAMES = [g2026020018, g2025020121, g2026010026, g2025030132, g2026010044, g2026020036, g2026020026, g2026020038]
const stat = (game, category) => game.rightRail.teamGameStats.find(s => s.category === category)

describe('computeShotAttempts on real games', () => {
  it('counts each goal once: WSH@CAR 2026-10-02 is CF 81-43, not 83-48', () => {
    const { pbp } = g2026020018
    const sa = computeShotAttempts(withoutShootout(pbp.plays), pbp.homeTeam.id)
    expect(sa.carCorsi).toBe(81)
    expect(sa.oppCorsi).toBe(43)
    expect(sa.corsiForPct).toBe(65.3)
    expect(sa.carFenwick).toBe(52) // 33 SOG + 19 missed
    expect(sa.oppFenwick).toBe(34) // 27 SOG + 7 missed
  })

  it('SOG (goals included) equals the official SOG in every tracked game', () => {
    for (const game of GAMES) {
      const { pbp } = game
      if (!hasShotTracking(pbp.plays)) continue
      const sa = computeShotAttempts(withoutShootout(pbp.plays), pbp.homeTeam.id)
      const sog = stat(game, 'sog')
      expect([pbp.id, sa.car.sog, sa.opp.sog]).toEqual([pbp.id, sog.homeValue, sog.awayValue])
    }
  })

  // 57-84 with the shootout's 3 attempts a side; they're no shot attempts.
  it('leaves the shootout out: CAR@COL 2025-10-23 (5-4 SO) is 31-48 SOG, Corsi 54-81', () => {
    const { pbp } = g2025020121
    const sa = computeShotAttempts(withoutShootout(pbp.plays), pbp.awayTeam.id)
    expect([sa.car.sog, sa.opp.sog]).toEqual([31, 48])
    expect([sa.carCorsi, sa.oppCorsi]).toEqual([54, 81])
  })
})

describe('power-play opportunities on real games', () => {
  it("equal the right-rail's official powerPlay for both teams in every game", () => {
    for (const game of GAMES) {
      const { pbp } = game
      const home = powerPlayRecord(pbp.plays, true, pbp.homeTeam.id)
      const away = powerPlayRecord(pbp.plays, false, pbp.awayTeam.id)
      const pp = stat(game, 'powerPlay')
      expect([pbp.id, `${home.goals}/${home.opps}`, `${away.goals}/${away.opps}`])
        .toEqual([pbp.id, pp.homeValue, pp.awayValue])
    }
  })

  it('does not count fights, coincidental minors or misconducts: UTA@NYR 2026-10-04 is NYR 0/4, UTA 1/2', () => {
    const { pbp } = g2026020036
    // The card used to count every opponent penalty play: 7 and 5.
    expect(pbp.plays.filter(p => p.typeDescKey === 'penalty' && p.details.eventOwnerTeamId === pbp.awayTeam.id)).toHaveLength(7)
    expect(powerPlayRecord(pbp.plays, true, pbp.homeTeam.id)).toMatchObject({ goals: 0, opps: 4 })
    expect(powerPlayRecord(pbp.plays, false, pbp.awayTeam.id)).toMatchObject({ goals: 1, opps: 2 })
  })

  it('does not count a penalty called at the final horn: CGY@SEA 2026-10-04 is CGY 1/2', () => {
    const { pbp } = g2026020038
    const cgy = powerPlayOpportunities(pbp.plays, false, pbp.awayTeam.id)
    expect(cgy.map(o => o.startLabel)).toEqual(['08:11', '13:33'])
    expect(cgy.map(o => o.goals)).toEqual([0, 1])
  })

  it("holds each opportunity's own plays: MTL@PIT 2026-10-03, PIT 2/4", () => {
    const { pbp } = g2026020026
    const pit = powerPlayOpportunities(pbp.plays, true, pbp.homeTeam.id)
    expect(pit).toHaveLength(4)
    expect(pit.reduce((n, o) => n + o.goals, 0)).toBe(2)
    for (const o of pit) {
      expect(o.plays.every(p => teamOnPowerPlay(p.situationCode, true))).toBe(true)
      expect(o.endSecs).toBeGreaterThanOrEqual(o.startSecs)
    }
  })

  it('works on a goals-and-penalties-only feed: NSH@CAR 2026-09-24 is 1/3 each', () => {
    const { pbp } = g2026010044
    expect(powerPlayRecord(pbp.plays, true, pbp.homeTeam.id)).toMatchObject({ goals: 1, opps: 3 })
    expect(powerPlayRecord(pbp.plays, false, pbp.awayTeam.id)).toMatchObject({ goals: 1, opps: 3 })
  })
})

describe('teamOnPowerPlay', () => {
  it('reads [awayGoalie][awaySkaters][homeSkaters][homeGoalie]', () => {
    expect(teamOnPowerPlay('1451', true)).toBe(true)   // home 5 v away 4
    expect(teamOnPowerPlay('1451', false)).toBe(false)
    expect(teamOnPowerPlay('1541', false)).toBe(true)
    expect(teamOnPowerPlay('1551', true)).toBe(false)
  })

  it('counts a pulled goalie as one skater fewer', () => {
    expect(teamOnPowerPlay('1560', true)).toBe(false)  // delayed-penalty 6-on-5: even
    expect(teamOnPowerPlay('0641', false)).toBe(true)  // power play with its goalie pulled
    expect(teamOnPowerPlay('1020', true)).toBe(false)  // impossible code
  })
})

describe('hasShotTracking', () => {
  it('is false for a goals-and-penalties-only feed (NSH@CAR 2026-09-24)', () => {
    expect(hasShotTracking(g2026010044.pbp.plays)).toBe(false)
    expect(hasShotTracking(g2026020018.pbp.plays)).toBe(true)
    expect(hasShotTracking(undefined)).toBe(false)
  })
})

describe('nhlPeriodLabel', () => {
  it('goes by the game type past OT', () => {
    expect(nhlPeriodLabel(2, false)).toBe('P2')
    expect(nhlPeriodLabel(4, false)).toBe('OT')
    expect(nhlPeriodLabel(4, true)).toBe('OT')
    expect(nhlPeriodLabel(5, false)).toBe('SO')
    expect(nhlPeriodLabel(5, true)).toBe('2OT')
    expect(nhlPeriodLabel(6, true)).toBe('3OT')
    expect(nhlPeriodLabel(undefined)).toBe('')
  })

  it("labels CAR-OTT 2026-04-20's winner 2OT, as the feed's own periodType says", () => {
    const { pbp } = g2025030132
    const winner = pbp.plays.filter(p => p.typeDescKey === 'goal').at(-1)
    expect(winner.periodDescriptor).toEqual({ number: 5, periodType: 'OT' })
    expect(nhlPeriodLabel(winner.periodDescriptor.number, pbp.gameType === 3)).toBe('2OT')
  })
})

describe('summaryTeam', () => {
  // /cache/summary:2026020025 as the Worker serves it (CAR 3-2 at PHI)
  const summary = { gameId: 2026020025, won: true, carScore: 3, oppScore: 2, oppAbbr: 'PHI', isHome: false, cfPct: 65, narrative: 'The Hurricanes secured a gritty 3-2 road victory…' }
  const game = { id: 2026020025, homeTeam: { abbrev: 'PHI' }, awayTeam: { abbrev: 'CAR' } }

  it("is the team the summary was written for, so a PHI fan doesn't get CAR's", () => {
    expect(summaryTeam(summary, game)).toBe('CAR')
  })

  it('reads a team field when the Worker stores one', () => {
    expect(summaryTeam({ ...summary, team: 'CAR' }, game)).toBe('CAR')
  })

  it("is null for a summary that doesn't fit the game", () => {
    expect(summaryTeam({ ...summary, oppAbbr: 'WSH' }, game)).toBeNull()
    expect(summaryTeam({ narrative: 'x' }, game)).toBeNull()
    expect(summaryTeam(summary, { homeTeam: { abbrev: 'PHI' } })).toBeNull()
  })
})
