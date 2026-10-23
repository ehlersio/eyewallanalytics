// src/components/__tests__/shootoutGoalPopup.test.jsx
// The game team's shootout goal gets its own popup (round and shootout
// tally, no assists) and counts toward no hat trick. CAR@EDM 2026020163
// replayed live through the real hook, one play at a time
// (testHelpers/nhlShootoutFixtures.js).

import { describe, it, expect, beforeEach } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { renderHook, resetSessionStorage } from '../../utils/__tests__/testHelpers/renderHook.jsx'
import '../../i18n/index.js'
import { useGameEvents, nhlGoalsByScorer, GoalPopup } from '../GameEvents.jsx'
import { buildPlayerMap } from '../../utils/nhlApi'
import { EDM, CAR, RNH, BUSSI, carAtEdm } from '../../utils/__tests__/testHelpers/nhlShootoutFixtures.js'

beforeEach(() => resetSessionStorage())

const textOf = el => renderToStaticMarkup(el).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()

// Every distinct popup the hook produced, in order.
function log(h, key) {
  const seen = []
  return { record() { const p = h.result.current[key]; if (p && p !== seen.at(-1)) seen.push(p) }, seen }
}

function replay(pbp, teamId, isHome) {
  const map = buildPlayerMap(pbp)
  const h = renderHook(({ pbp, isLive }) => useGameEvents(pbp, isLive, map, isHome, teamId, 'X', '#c00'), { pbp: null, isLive: false })
  const goals = log(h, 'goalPopup')
  const hatTricks = log(h, 'hatTrickPopup')
  for (let k = 1; k <= pbp.plays.length; k++) {
    h.rerender({ pbp: { ...pbp, plays: pbp.plays.slice(0, k) }, isLive: true })
    goals.record(); hatTricks.record()
  }
  return { h, goals: goals.seen, hatTricks: hatTricks.seen }
}

// Nugent-Hopkins with two goals in regulation, then the shootout winner.
function twoAndTheWinner() {
  const pbp = carAtEdm()
  const reg = n => ({ eventId: 20 + n, typeDescKey: 'goal', timeInPeriod: `0${n}:00`, periodDescriptor: { number: 3, periodType: 'REG' },
    details: { eventOwnerTeamId: EDM, scoringPlayerId: RNH, goalieInNetId: BUSSI, shotType: 'snap' } })
  return { ...pbp, plays: [pbp.plays[0], reg(1), reg(2), ...pbp.plays.slice(1)] }
}

describe('shootout goal popup', () => {
  it('pops up the game team’s shootout goal with its round and tally', () => {
    const { goals } = replay(carAtEdm(), EDM, true)
    expect(goals).toHaveLength(1)
    expect(goals[0]).toEqual({
      scorer: 'Ryan Nugent-Hopkins', shotType: 'wrist', isShootout: true, round: 3, soScore: '1–0', period: 'SO', time: null,
    })
  })

  it('is nothing for the other team’s shootout goal', () => {
    const { goals } = replay(carAtEdm(), CAR, false)
    expect(goals).toHaveLength(0)
  })

  it('does not make a hat trick of two goals and a shootout goal', () => {
    const pbp = twoAndTheWinner()
    expect(nhlGoalsByScorer(pbp.plays, EDM).counts[String(RNH)]).toBe(2)
    const { goals, hatTricks } = replay(pbp, EDM, true)
    expect(hatTricks).toHaveLength(0)
    expect(goals.map(g => !!g.isShootout)).toEqual([false, false, true])
  })

  it('pops up once per shootout goal', () => {
    const pbp = carAtEdm()
    const { h, goals } = replay(pbp, EDM, true)
    // The same plays back (a poll with nothing new, or the hook re-reading them).
    h.rerender({ pbp: { ...pbp, plays: [...pbp.plays] }, isLive: true })
    expect(goals).toHaveLength(1)
    expect(h.result.current.goalPopup).toBe(goals[0])
  })
})

describe('GoalPopup for a shootout goal', () => {
  it('shows the shootout title and line, and no assists', () => {
    const text = textOf(<GoalPopup data={{ scorer: 'Ryan Nugent-Hopkins', assists: ['Somebody'], shotType: 'wrist',
      isShootout: true, round: 3, soScore: '1–1', period: 'SO', time: null }} onClose={() => {}} />)
    expect(text).toContain('SHOOTOUT GOAL!')
    expect(text).toContain('Round 3 · SO 1–1')
    expect(text).not.toContain('Assists')
  })

  it('falls back to SO without a round', () => {
    const text = textOf(<GoalPopup data={{ scorer: 'X', isShootout: true, round: null, soScore: null, period: 'SO', time: null }} onClose={() => {}} />)
    expect(text).toMatch(/X SO/)
  })

  it('keeps the regular goal’s period and time', () => {
    const text = textOf(<GoalPopup data={{ scorer: 'X', assists: ['Y'], period: 'P2', time: '12:34' }} onClose={() => {}} />)
    expect(text).toContain('GOAL!')
    expect(text).toContain('Assists: Y')
    expect(text).toContain('P2 · 12:34')
  })
})
