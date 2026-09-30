// src/utils/__tests__/pwhlGoaliesInNet.test.js
// Which goalie the PWHL AI summary is told is in net. It used to take the
// first goalie among the three stars -- in game 210 that was TOR's Raygan
// Kirk, handed to Minnesota's summary. Now it reads the team's own stints
// from /pwhl/summary's goalieLog.

import { describe, it, expect } from 'vitest'
import { pwhlGoaliesInNet } from '../../hooks/usePWHLPeriodSummary.js'

const MIN = 2
const TOR = 6
const stint = (teamId, firstName, lastName, periodStart, periodEnd) => ({ teamId, id: 0, firstName, lastName, periodStart, periodEnd })

// Game 210 as HockeyTech logged it: Kirk has three stints (pulled twice for
// an extra attacker).
const game210 = {
  goalieLog: [
    stint(MIN, 'Maddie', 'Rooney', 1, 3),
    stint(TOR, 'Raygan', 'Kirk', 1, 2),
    stint(TOR, 'Raygan', 'Kirk', 2, 3),
    stint(TOR, 'Raygan', 'Kirk', 3, 3),
  ],
}

describe('pwhlGoaliesInNet', () => {
  it("names the team's own goalie, not the other team's", () => {
    expect(pwhlGoaliesInNet(game210, MIN)).toEqual(['Maddie Rooney'])
    expect(pwhlGoaliesInNet(game210, TOR)).toEqual(['Raygan Kirk'])
  })

  it('names each goalie once, in order, after a change', () => {
    const log = { goalieLog: [stint(MIN, 'Maddie', 'Rooney', 1, 2), stint(MIN, 'Nicole', 'Hensley', 2, 3)] }
    expect(pwhlGoaliesInNet(log, MIN)).toEqual(['Maddie Rooney', 'Nicole Hensley'])
  })

  it('scopes to the goalies in net during one period', () => {
    const log = { goalieLog: [stint(MIN, 'Maddie', 'Rooney', 1, 2), stint(MIN, 'Nicole', 'Hensley', 2, 3)] }
    expect(pwhlGoaliesInNet(log, MIN, 1)).toEqual(['Maddie Rooney'])
    expect(pwhlGoaliesInNet(log, MIN, 2)).toEqual(['Maddie Rooney', 'Nicole Hensley'])
    expect(pwhlGoaliesInNet(log, MIN, 3)).toEqual(['Nicole Hensley'])
    expect(pwhlGoaliesInNet(log, MIN, 4)).toEqual([])
  })

  it('treats a stint with no end yet as still in net (live game)', () => {
    const log = { goalieLog: [stint(MIN, 'Maddie', 'Rooney', 1, null)] }
    expect(pwhlGoaliesInNet(log, MIN, 3)).toEqual(['Maddie Rooney'])
  })

  it('names no one without a goalieLog (a summary cached before the worker sent one)', () => {
    expect(pwhlGoaliesInNet({ periods: [], mvps: [] }, MIN)).toEqual([])
    expect(pwhlGoaliesInNet(null, MIN, 1)).toEqual([])
  })
})
