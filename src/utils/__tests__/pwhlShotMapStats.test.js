// src/utils/__tests__/pwhlShotMapStats.test.js
// The PWHL Shot Map's "Shots on goal" card left out goals: OTT in game 328
// (2026-04-25, TOR @ OTT 0-3; HockeyTech's gameSummary has OTT 31 shots,
// TOR 41) read 28. Fixtures are the Worker's real answers for that game:
//   ott-shots.json  /pwhl/shots?teamId=5&season=8, game 328's rows
//   opp-shots.json  /pwhl/pbp?gameId=328 opp_shots (both teams)
//   live.json       /pwhl/live/328 (the live feed's shape, game final)

import { describe, it, expect } from 'vitest'
import { pwhlShotMapCounts, dropRepeatedLiveGoals } from '../pwhlShotMapStats'
import { computePWHLShotStats } from '../../hooks/usePWHLPeriodSummary.js'
import ottShots from './fixtures/pwhl-game-328/ott-shots.json'
import oppShots from './fixtures/pwhl-game-328/opp-shots.json'
import live from './fixtures/pwhl-game-328/live.json'

const OTT = 5
const TOR = 6

// The view's adapters' `type` (PWHLShotMapView.jsx mapEventType).
const asRinkEvents = rows => rows.map(r => ({
  type: r.event_type === 'goal' ? 'goal' : r.event_type === 'blocked_shot' ? 'blocked-shot' : 'shot-on-goal',
}))

describe('pwhlShotMapCounts', () => {
  const ours = asRinkEvents(ottShots)
  const theirs = asRinkEvents(oppShots.filter(r => r.team_id === TOR))

  it('counts goals as shots on goal, matching HockeyTech (OTT 31, TOR 41)', () => {
    const c = pwhlShotMapCounts(ours, theirs)
    expect(c.sog).toBe(31)
    expect(c.goals).toBe(3)
    expect(c.oppSOG).toBe(41)
  })

  it('counts blocked shots apart from shots on goal', () => {
    const c = pwhlShotMapCounts(ours, theirs)
    expect(c.blocks).toBe(5)
    expect(c.oppBlocked).toBe(9)
    expect(c.total).toBe(36)
  })

  it('agrees with the period/game summaries (computePWHLShotStats)', () => {
    const c = pwhlShotMapCounts(ours, theirs)
    const s = computePWHLShotStats(live.events, OTT)
    expect(c.sog).toBe(s.carSOG)
    expect(c.oppSOG).toBe(s.oppSOG)
  })

  it('reads 0 opponent shots when there are none (the season view)', () => {
    expect(pwhlShotMapCounts(ours).oppSOG).toBe(0)
  })
})

describe('dropRepeatedLiveGoals', () => {
  const shotsAndGoals = events => events.filter(e => ['shot', 'goal'].includes(e.eventType) && e.teamId === OTT)

  it('the live feed sends each OTT goal twice: a shot with isGoal and a goal event', () => {
    expect(shotsAndGoals(live.events).filter(e => e.eventType === 'shot' && e.isGoal)).toHaveLength(3)
    expect(shotsAndGoals(live.events).filter(e => e.eventType === 'goal')).toHaveLength(3)
  })

  it('keeps one event per goal, so the live map shows 31 shots on goal and 3 goals', () => {
    const kept = shotsAndGoals(dropRepeatedLiveGoals(live.events))
    expect(kept).toHaveLength(31)
    expect(kept.filter(e => e.eventType === 'goal' || e.isGoal)).toHaveLength(3)
  })

  it('keeps a goal event that has no matching shot', () => {
    const goal = live.events.find(e => e.eventType === 'goal')
    const withoutItsShot = live.events.filter(e => !(e.eventType === 'shot' && e.isGoal && e.timeSeconds === goal.timeSeconds && e.period === goal.period))
    expect(dropRepeatedLiveGoals(withoutItsShot)).toContain(goal)
  })

  it('leaves every other event alone', () => {
    const others = live.events.filter(e => e.eventType !== 'goal')
    expect(dropRepeatedLiveGoals(live.events).filter(e => e.eventType !== 'goal')).toEqual(others)
  })
})
