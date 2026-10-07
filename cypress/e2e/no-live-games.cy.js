// cypress/e2e/no-live-games.cy.js
// withoutLiveGames() (support/noLiveGames.js): a real game in progress is
// relabeled not-yet-started for every spec, so the suite doesn't depend on
// whether CAR happens to be playing while it runs. The intercepts
// themselves (interceptLiveGames) run in every spec; with no game in
// progress they pass responses through unchanged.

import { withoutLiveGames, withoutHockeyTechLiveGames } from '../support/noLiveGames'

describe('Suite isolation from real live games', () => {
  it('relabels LIVE and CRIT games FUT and leaves the rest alone', () => {
    const games = [
      { id: 1, gameState: 'OFF' },
      { id: 2, gameState: 'LIVE' },
      { id: 3, gameState: 'CRIT' },
      { id: 4, gameState: 'FUT' },
      { id: 5, gameState: 'FINAL' },
    ]
    expect(withoutLiveGames(games).map(g => g.gameState)).to.deep.equal(['OFF', 'FUT', 'FUT', 'FUT', 'FINAL'])
    expect(withoutLiveGames(null)).to.equal(null)
  })

  it('relabels PWHL/AHL/ECHL /today rows under way as not started', () => {
    const rows = [{ gameId: 1, status: 'pre' }, { gameId: 2, status: 'live' }, { gameId: 3, status: 'final' }]
    expect(withoutHockeyTechLiveGames(rows).map(g => g.status)).to.deep.equal(['pre', 'pre', 'final'])
    expect(withoutHockeyTechLiveGames(null)).to.equal(null)
  })
})
