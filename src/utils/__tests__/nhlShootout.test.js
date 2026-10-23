// src/utils/__tests__/nhlShootout.test.js
// Shootouts read from the play-by-play. The fixtures follow real games'
// attempts -- see testHelpers/nhlShootoutFixtures.js.

import { describe, it, expect } from 'vitest'
import i18n from '../../i18n/index.js'
import { shootoutAttempts, shootoutSummary, shootoutScoreFor, missReasonKey, missReasonLabel } from '../nhlShootout.js'
import {
  EDM, CAR, LEVI, BUSSI, MCDAVID, carAtEdm, quinnNoShot, regulationGoal as regulation,
} from './testHelpers/nhlShootoutFixtures.js'

describe('shootoutAttempts', () => {
  it('reads every attempt in order with shooter, goalie, result and the running tally', () => {
    const a = shootoutAttempts(carAtEdm())
    expect(a.map(x => x.result)).toEqual(['save', 'save', 'save', 'miss', 'goal', 'miss'])
    expect(a.map(x => x.sequence)).toEqual([1, 2, 3, 4, 5, 6])
    expect(a.map(x => x.round)).toEqual([1, 1, 2, 2, 3, 3])
    expect(a[0]).toMatchObject({
      teamId: EDM, shooterId: MCDAVID, shooterName: 'Connor McDavid', goalieId: BUSSI, goalieName: 'Brandon Bussi',
      shooterHeadshot: `https://assets.nhle.com/mugs/nhl/${MCDAVID}.png`, shotType: 'wrist', reason: null,
    })
    expect(a[3]).toMatchObject({ shooterName: 'Andrei Svechnikov', goalieName: 'Devon Levi', reason: 'wide-left' })
    expect(a[5].shooterHeadshot).toBeNull()
    // The shootout's own tally; the game score on the goal play doesn't move.
    expect(a.map(x => [x.homeGoals, x.awayGoals])).toEqual([[0, 0], [0, 0], [0, 0], [0, 0], [1, 0], [1, 0]])
  })

  it('marks the winner’s last goal once it’s decided', () => {
    const a = shootoutAttempts(carAtEdm())
    expect(a.filter(x => x.gameWinner).map(x => x.shooterName)).toEqual(['Ryan Nugent-Hopkins'])
  })

  it('reads a lost puck as no shot, with no shot type or reason', () => {
    const a = shootoutAttempts(quinnNoShot())
    expect(a[3]).toMatchObject({ result: 'noShot', shooterName: 'Jack Quinn', shotType: null, reason: null, round: 2 })
    // Players missing from the roster get no name rather than an invented one.
    expect(a[0]).toMatchObject({ shooterName: null, goalieName: null, shooterHeadshot: null })
    // Decided by the game state alone: no shootout-complete play here.
    expect(a[2].gameWinner).toBe(true)
  })

  it('is empty without a shootout', () => {
    expect(shootoutAttempts(undefined)).toEqual([])
    expect(shootoutAttempts({ plays: [regulation] })).toEqual([])
  })
})

describe('shootoutSummary', () => {
  it('sums up a finished shootout', () => {
    const s = shootoutSummary(carAtEdm())
    expect(s).toMatchObject({ isShootout: true, complete: true, tally: { home: 1, away: 0 }, round: 3, winnerTeamId: EDM, nextTeamId: null })
    expect(s.byTeam[EDM].map(a => a.shooterName)).toEqual(['Connor McDavid', 'Leon Draisaitl', 'Ryan Nugent-Hopkins'])
    expect(s.byTeam[CAR]).toHaveLength(3)
    // The goalie each team shoots against.
    expect(s.goalieFor[EDM]).toEqual({ id: BUSSI, name: 'Brandon Bussi' })
    expect(s.goalieFor[CAR]).toEqual({ id: LEVI, name: 'Devon Levi' })
  })

  it('is complete on a shootout-complete play even while the game is still live', () => {
    const s = shootoutSummary(carAtEdm({ gameState: 'LIVE' }))
    expect(s.complete).toBe(true)
    expect(s.winnerTeamId).toBe(EDM)
  })

  it('names no winner and no game winner mid-shootout, and knows who shoots next', () => {
    // EDM 2 shots, CAR 1: CAR is a shot behind.
    let s = shootoutSummary(carAtEdm({ through: 3, complete: false }))
    expect(s).toMatchObject({ isShootout: true, complete: false, winnerTeamId: null, nextTeamId: CAR, round: 2 })
    // Even at 2 each, CAR shot last: EDM next.
    s = shootoutSummary(carAtEdm({ through: 4, complete: false }))
    expect(s.nextTeamId).toBe(EDM)
    // A goal mid-shootout isn't the winner yet.
    s = shootoutSummary(carAtEdm({ through: 5, complete: false }))
    expect(s.tally).toEqual({ home: 1, away: 0 })
    expect(s.nextTeamId).toBe(CAR)
    expect(s.attempts.some(a => a.gameWinner)).toBe(false)
  })

  it('has no next team before the first attempt', () => {
    const s = shootoutSummary(carAtEdm({ through: 0, complete: false }))
    expect(s).toMatchObject({ isShootout: true, complete: false, round: 0, nextTeamId: null, tally: { home: 0, away: 0 } })
    expect(s.byTeam).toEqual({ [EDM]: [], [CAR]: [] })
  })

  it('is no shootout for a game without one, or no play-by-play', () => {
    for (const pbp of [undefined, null, {}, { gameState: 'OFF', plays: [regulation] }]) {
      expect(shootoutSummary(pbp)).toMatchObject({ isShootout: false, complete: false, attempts: [], round: 0, winnerTeamId: null, nextTeamId: null })
    }
  })
})

describe('shootoutScoreFor', () => {
  it('reads the tally from either side', () => {
    const s = shootoutSummary(carAtEdm())
    expect(shootoutScoreFor(s, EDM)).toEqual({ team: 1, opp: 0 })
    expect(shootoutScoreFor(s, CAR)).toEqual({ team: 0, opp: 1 })
    expect(shootoutScoreFor(shootoutSummary(undefined), CAR)).toEqual({ team: 0, opp: 0 })
  })
})

describe('miss reasons', () => {
  const t = i18n.getFixedT('en')
  const fr = i18n.getFixedT('fr')

  it('labels the reasons it knows', () => {
    expect(missReasonKey('wide-left')).toBe('shotMapView.shootout.reasons.wideLeft')
    expect(missReasonKey('hit-crossbar', { short: true })).toBe('shotMapView.shootout.reasonsShort.hitCrossbar')
    expect(missReasonLabel('wide-left', t)).toBe('Wide left')
    expect(missReasonLabel('hit-crossbar', fr)).toBe('Sur la barre')
    for (const r of ['wide-left', 'wide-right', 'high-and-wide-left', 'high-and-wide-right', 'over-net',
      'hit-left-post', 'hit-right-post', 'hit-crossbar', 'short', 'blocked']) {
      for (const short of [false, true]) {
        const key = missReasonKey(r, { short })
        expect(i18n.exists(key, { lng: 'en' }), key).toBe(true)
        expect(i18n.exists(key, { lng: 'fr' }), key).toBe(true)
      }
    }
  })

  it('falls back to the feed’s own words for one it doesn’t', () => {
    expect(missReasonKey('hit-glass')).toBeNull()
    expect(missReasonLabel('hit-glass', t)).toBe('hit glass')
    expect(missReasonLabel(null, t)).toBeNull()
  })
})
