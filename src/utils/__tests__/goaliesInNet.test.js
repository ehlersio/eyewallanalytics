// src/utils/__tests__/goaliesInNet.test.js
// Which goalie the AI period summary is told is in net. It used to take the
// first goalie in the play-by-play's rosterSpots, which isn't ordered by who
// starts -- so the summary named the backup. Now it reads goalieInNetId off
// the shots the team faced.

import { describe, it, expect } from 'vitest'
import { goaliesInNet } from '../../hooks/usePeriodSummary.js'

const CAR = 12
const OPP = 13
const rosterMap = { 1: 'Frederik Andersen', 2: 'Pyotr Kochetkov', 3: 'Sergei Bobrovsky' }
const shot = (type, owner, goalie) => ({ typeDescKey: type, details: { eventOwnerTeamId: owner, goalieInNetId: goalie } })

describe('goaliesInNet', () => {
  it('names the goalie who faced shots, not the first one on the roster', () => {
    const plays = [shot('shot-on-goal', OPP, 2), shot('missed-shot', OPP, 2), shot('shot-on-goal', CAR, 3)]
    expect(goaliesInNet(plays, rosterMap, CAR)).toEqual(['Pyotr Kochetkov'])
  })

  it('names both goalies, in order, after a change', () => {
    const plays = [shot('shot-on-goal', OPP, 1), shot('goal', OPP, 1), shot('shot-on-goal', OPP, 2)]
    expect(goaliesInNet(plays, rosterMap, CAR)).toEqual(['Frederik Andersen', 'Pyotr Kochetkov'])
  })

  it('names no one when the team faced no shots', () => {
    const plays = [shot('shot-on-goal', CAR, 3), shot('blocked-shot', OPP, undefined), { typeDescKey: 'hit', details: { eventOwnerTeamId: OPP } }]
    expect(goaliesInNet(plays, rosterMap, CAR)).toEqual([])
  })

  it('skips empty-net shots and unknown ids', () => {
    const plays = [shot('goal', OPP, undefined), shot('shot-on-goal', OPP, 99)]
    expect(goaliesInNet(plays, rosterMap, CAR)).toEqual([])
  })
})
