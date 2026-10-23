// utils/__tests__/testHelpers/nhlShootoutFixtures.js
// NHL play-by-play with a shootout, for nhlShootout.test.js and the
// components that read it. Follows real games' attempts (order, results,
// miss reasons, goalies):
//   2026020163 CAR@EDM: McDavid save, Gostisbehere save, Draisaitl save,
//     Svechnikov wide left, Nugent-Hopkins goal, Jarvis wide right. EDM
//     wins 1-0, Levi in EDM's net, Bussi in CAR's.
//   2026020092: the 4th attempt a failed-shot-attempt (Quinn) -- the teams
//     and the other shooters in quinnNoShot() are stand-ins.
// Shot types are illustrative. Every attempt is at 0:00 in period 5.

export const EDM = 22
export const CAR = 12
export const LEVI = 8482221, BUSSI = 8483548
export const MCDAVID = 8478402, DRAISAITL = 8477934, RNH = 8476454
export const GOSTISBEHERE = 8476906, SVECHNIKOV = 8480830, JARVIS = 8482093
export const QUINN = 8482097

const SO = { number: 5, periodType: 'SO' }

export const spot = (teamId, playerId, first, last, headshot = `https://assets.nhle.com/mugs/nhl/${playerId}.png`) =>
  ({ teamId, playerId, firstName: { default: first }, lastName: { default: last }, sweaterNumber: 0, positionCode: 'C', headshot })

let nextId = 900
const so = (typeDescKey, details = {}) => ({
  eventId: nextId++, typeDescKey, timeInPeriod: '00:00', periodDescriptor: SO, details,
})
const goal = (team, shooter, goalie, shotType = 'wrist') =>
  so('goal', { eventOwnerTeamId: team, scoringPlayerId: shooter, goalieInNetId: goalie, shotType, homeScore: 2, awayScore: 2 })
const save = (team, shooter, goalie, shotType = 'wrist') =>
  so('shot-on-goal', { eventOwnerTeamId: team, shootingPlayerId: shooter, goalieInNetId: goalie, shotType })
const miss = (team, shooter, goalie, reason, shotType = 'snap') =>
  so('missed-shot', { eventOwnerTeamId: team, shootingPlayerId: shooter, goalieInNetId: goalie, shotType, reason })
const noShot = (team, shooter, goalie) =>
  so('failed-shot-attempt', { eventOwnerTeamId: team, shootingPlayerId: shooter, goalieInNetId: goalie })

const ROSTER = [
  spot(EDM, MCDAVID, 'Connor', 'McDavid'), spot(EDM, DRAISAITL, 'Leon', 'Draisaitl'),
  spot(EDM, RNH, 'Ryan', 'Nugent-Hopkins'), spot(EDM, LEVI, 'Devon', 'Levi'),
  spot(CAR, GOSTISBEHERE, 'Shayne', 'Gostisbehere'), spot(CAR, SVECHNIKOV, 'Andrei', 'Svechnikov'),
  spot(CAR, JARVIS, 'Seth', 'Jarvis', null), spot(CAR, BUSSI, 'Brandon', 'Bussi'),
]

export const regulationGoal = { eventId: 10, typeDescKey: 'goal', timeInPeriod: '05:12', periodDescriptor: { number: 2, periodType: 'REG' },
  details: { eventOwnerTeamId: EDM, scoringPlayerId: MCDAVID, goalieInNetId: BUSSI, shotType: 'wrist' } }

// CAR@EDM: the first `through` attempts (all six by default); `complete`
// adds the shootout-complete, period-end and game-end plays.
export function carAtEdm({ through, complete = true, gameState = complete ? 'OFF' : 'LIVE' } = {}) {
  nextId = 900
  const attempts = [
    save(EDM, MCDAVID, BUSSI),
    save(CAR, GOSTISBEHERE, LEVI),
    save(EDM, DRAISAITL, BUSSI, 'backhand'),
    miss(CAR, SVECHNIKOV, LEVI, 'wide-left'),
    goal(EDM, RNH, BUSSI),
    miss(CAR, JARVIS, LEVI, 'wide-right'),
  ].slice(0, through)
  const plays = [regulationGoal, so('period-start'), ...attempts]
  if (complete) plays.push(so('shootout-complete'), so('period-end'), so('game-end'))
  return {
    id: 2026020163, gameType: 2, gameState,
    periodDescriptor: SO, clock: { timeRemaining: '00:00', inIntermission: false },
    homeTeam: { id: EDM, abbrev: 'EDM' }, awayTeam: { id: CAR, abbrev: 'CAR' },
    rosterSpots: ROSTER, plays,
  }
}

// A lost puck as the 4th attempt, decided by the game state alone (no
// shootout-complete play). Only Quinn is on the roster.
export function quinnNoShot() {
  nextId = 900
  return {
    gameState: 'OFF', homeTeam: { id: 1 }, awayTeam: { id: 7 },
    rosterSpots: [spot(7, QUINN, 'Jack', 'Quinn')],
    plays: [
      save(1, 101, 201), save(7, 102, 202), goal(1, 103, 201), noShot(7, QUINN, 202),
      save(1, 104, 201), save(7, 105, 202),
    ],
  }
}
