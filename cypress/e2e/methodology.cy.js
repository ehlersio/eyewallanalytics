// cypress/e2e/methodology.cy.js
// The How it works page (/methodology, 2026-09): every section renders,
// each model's backtest line comes from /scorecard (stubbed here so it
// doesn't depend on live data), and it links to and from the scorecard.

const row = (model, extra) => ({
  model, kind: 'backtest', status: 'ok', period: '2023-24 to 2025-26', calibration: [], recent: [], note: null, ...extra,
})
const SCORECARD = {
  updatedAt: '2026-09-14T08:00:00Z',
  models: {
    game_winner: {
      live: { model: 'game_winner', kind: 'live', status: 'pending', period: '2026-27', n: 0 },
      backtest: row('game_winner', { n: 3936, accuracy: 0.565, brier: 0.242, baseline: { name: 'home_team_wins', accuracy: 0.542, brier: 0.248 } }),
    },
    starting_goalie: {
      live: { model: 'starting_goalie', kind: 'live', status: 'pending', period: '2026-27', n: 0 },
      backtest: row('starting_goalie', { n: 5248, accuracy: 0.739, brier: 0.36, baseline: { name: 'last_games_starter', accuracy: 0.571, brier: null } }),
    },
    playoff_odds: {
      live: { model: 'playoff_odds', kind: 'live', status: 'pending', period: '2026-27', n: 0 },
      backtest: row('playoff_odds', { n: 384, accuracy: 0.716, brier: 0.162, baseline: { name: 'holds_a_playoff_spot', accuracy: 0.714, brier: 0.224 } }),
    },
  },
}

const TITLES = [
  'Ground rules', 'Game winners', 'Starting goalies', 'Playoff odds', 'How the scorecard grades',
  'Injury impact', 'Trade trees', 'Data and schedule', 'Changelog',
]

describe('Methodology page', () => {
  beforeEach(() => {
    cy.intercept('GET', '**/scorecard', SCORECARD).as('scorecard')
  })

  it('renders every section with its live backtest line', () => {
    cy.visit('/methodology')
    cy.wait('@scorecard')
    cy.contains('h1', 'How it works').should('exist')
    cy.get('.method-section').should('have.length', TITLES.length)
    TITLES.forEach(title => cy.contains('.method-section h2', title).should('exist'))
    cy.get('#game-winners .method-backtest')
      .should('contain', 'picked right 56.5%')
      .and('contain', 'Baseline, the home team wins: 54.2%')
    cy.get('#starting-goalies .method-backtest').should('contain', '73.9%')
    cy.get('#playoff-odds .method-limits li').should('have.length.at.least', 2)
    cy.get('.method-changelog li').should('have.length.at.least', 6)
  })

  it('says so when the scorecard data is unavailable', () => {
    cy.intercept('GET', '**/scorecard', { statusCode: 502, body: {} }).as('down')
    cy.visit('/methodology')
    cy.wait('@down')
    cy.get('#game-winners .method-backtest').should('contain', "aren't available right now")
  })

  it('links from the scorecard and back to it', () => {
    cy.visit('/league?tab=scorecard')
    cy.get('.prediction-scorecard', { timeout: 10000 }).should('exist')
    cy.get('.scorecard-method-link').click()
    cy.location('pathname').should('eq', '/methodology')
    cy.get('.method-back').click()
    cy.location('search').should('eq', '?tab=scorecard')
    cy.get('.prediction-scorecard', { timeout: 10000 }).should('exist')
  })
})
