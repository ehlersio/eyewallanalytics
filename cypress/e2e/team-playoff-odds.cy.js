// cypress/e2e/team-playoff-odds.cy.js
// Playoff odds card on the Team page's Overview tab (2026-09), from the
// Worker's /playoff-odds route (eyewall-pipeline's nightly playoff_odds.py).
// The route is stubbed with cy.intercept, so nothing depends on live data --
// the table only fills once the regular season's nightly runs start. The
// route's own query/caching logic is covered by eyewall-poller's Vitest
// suite (nhl-routes.test.js, playoffOdds.test.js).

const LATEST = {
  season: 20262027, run_date: '2026-10-15', playoff_pct: 0.641, division_pct: 0.214, proj_points: 95.3,
  points_p10: 87, points_p90: 103, current_points: 4, games_played: 3, games_remaining: 81, elo_rating: 1531.2, sims: 10000,
  change: {
    prev_run_date: '2026-10-14', prev_pct: 0.58, delta: 0.061,
    contributions: [
      { game_id: 2026020031, game_date: '2026-10-14', home: 'CAR', away: 'OTT', winner: 'CAR', delta: 0.04 },
      { game_id: 2026020033, game_date: '2026-10-14', home: 'NYR', away: 'BOS', winner: 'NYR', delta: 0.012 },
    ],
    residual: 0.009,
  },
}

const ODDS = {
  team: 'CAR', season: 20262027, runDate: '2026-10-15', stale: false, latest: LATEST,
  history: [
    { run_date: '2026-10-13', playoff_pct: 0.55 },
    { run_date: '2026-10-14', playoff_pct: 0.58 },
    { run_date: '2026-10-15', playoff_pct: 0.641 },
  ],
  nextGames: [
    { game_id: 2026020040, game_date: '2026-10-16', home: 'CAR', away: 'OTT', ifHomeWins: 0.66, ifAwayWins: 0.57, own: true, swing: 0.09 },
    { game_id: 2026020041, game_date: '2026-10-16', home: 'NYR', away: 'BOS', ifHomeWins: 0.62, ifAwayWins: 0.6, own: false, swing: 0.02 },
  ],
}

function openOverview(body) {
  cy.intercept('GET', '**/playoff-odds?team=*', body).as('odds')
  cy.visit('/team')
  cy.wait('@odds')
}

describe('Team page — Overview tab, Playoff odds card', () => {
  it('shows playoff, division and projected-points odds', () => {
    openOverview(ODDS)
    cy.get('.playoff-odds').within(() => {
      cy.contains('Playoff odds').should('exist')
      cy.get('.playoff-odds-main').should('contain', '64%')
      cy.get('.playoff-odds-division').should('contain', '21%')
      cy.get('.playoff-odds-points').should('contain', '95').and('contain', '87–103')
      cy.get('.playoff-odds-trend svg').should('exist')
    })
  })

  it('explains the change since the last run, game by game', () => {
    openOverview(ODDS)
    cy.get('.playoff-odds-delta').should('contain', '▲ 6.1 pts since')
    cy.get('.playoff-odds-contribution').should('have.length', 2)
    cy.get('.playoff-odds-contribution').first().should('contain', 'CAR beat OTT').and('contain', '+4.0')
    cy.get('.playoff-odds-contribution').eq(1).should('contain', 'NYR beat BOS').and('contain', '+1.2')
    cy.get('.playoff-odds-residual').should('contain', 'Rating changes').and('contain', '+0.9')
  })

  it("shows the next game day's stakes, own game first", () => {
    openOverview(ODDS)
    cy.get('.playoff-odds-next-game').should('have.length', 2)
    cy.get('.playoff-odds-next-game').first().should('contain', 'OTT @ CAR').and('contain', 'OTT win: 57%').and('contain', 'CAR win: 66%')
    cy.get('.playoff-odds-next-game').eq(1).should('contain', 'BOS @ NYR')
  })

  it('labels early-season odds, and drops the label later in the season', () => {
    openOverview(ODDS)
    cy.get('.playoff-odds-early').should('contain', 'Early season')
    openOverview({ ...ODDS, latest: { ...LATEST, games_played: 41 } })
    cy.get('.playoff-odds').should('contain', '64%')
    cy.get('.playoff-odds-early').should('not.exist')
  })

  it('labels odds that stopped updating and hides the next-game stakes', () => {
    openOverview({ ...ODDS, stale: true, latest: { ...LATEST, games_played: 82 } })
    cy.get('.playoff-odds-stale').should('contain', 'Not updated since')
    cy.get('.playoff-odds-early').should('not.exist')
    cy.get('.playoff-odds-next').should('not.exist')
  })

  it('first run of a season: no change section, and -0.0 moves read as no change', () => {
    openOverview({ ...ODDS, latest: { ...LATEST, change: null } })
    cy.get('.playoff-odds').should('contain', '64%')
    cy.get('.playoff-odds-change').should('not.exist')
    openOverview({ ...ODDS, latest: { ...LATEST, change: { ...LATEST.change, delta: 0.0002, contributions: [], residual: 0.0002 } } })
    cy.get('.playoff-odds-delta').should('contain', 'No change since')
    cy.get('.playoff-odds-residual').should('not.exist')
  })

  it('shows an empty state before the first run, and an unavailable state on failure', () => {
    openOverview({ team: 'CAR', season: null, runDate: null, stale: false, latest: null, history: [], nextGames: [] })
    cy.get('.playoff-odds').should('contain', 'Playoff odds appear after the first nightly model run')
    openOverview({ team: 'CAR', latest: null, history: [], nextGames: [], unavailable: true })
    cy.get('.playoff-odds').should('contain', "Playoff odds aren't available right now.")
    openOverview({ statusCode: 502, body: {} })
    cy.get('.playoff-odds').should('contain', "Playoff odds aren't available right now.")
  })
})
