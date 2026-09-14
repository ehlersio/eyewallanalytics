// cypress/e2e/league-scorecard.cy.js
// League page -> Scorecard tab (2026-09): the public prediction scorecard,
// from the Worker's /scorecard route (eyewall-pipeline's nightly
// prediction_scorecard.py). /scorecard is stubbed, so nothing depends on
// live data: the backtest rows are the real ones written 2026-09-13, the
// live rows are either the real pre-season "pending" rows or a made-up
// graded state. The route's own logic is covered by eyewall-poller's Vitest
// suite (nhl-routes.test.js, scorecard.test.js).

const cal = (...pairs) => pairs.map(([bucket, predicted, actual, n]) => ({ bucket, predicted, actual, n }))

const BACKTEST = {
  game_winner: {
    model: 'game_winner', kind: 'backtest', period: '2023-24 to 2025-26', status: 'ok', n: 3936,
    accuracy: 0.5648, brier: 0.2419, log_loss: 0.6767,
    baseline: { name: 'home_team_wins', accuracy: 0.5419, brier: 0.2482 },
    calibration: cal([3, 0.37, 0.34, 400], [5, 0.55, 0.53, 1500], [6, 0.64, 0.66, 900]),
    recent: [], note: 'Elo replayed on every regular-season game. A backtest, not predictions published at the time.',
  },
  starting_goalie: {
    model: 'starting_goalie', kind: 'backtest', period: '2024-25 to 2025-26', status: 'ok', n: 5246,
    accuracy: 0.7385, brier: 0.3605, log_loss: 0.5355,
    baseline: { name: 'last_games_starter', accuracy: 0.5711, brier: 0.4916 },
    calibration: cal([5, 0.56, 0.60, 1563], [8, 0.84, 0.85, 895]),
    recent: [], note: 'Each season scored by a model fit only on earlier seasons.',
  },
  playoff_odds: {
    model: 'playoff_odds', kind: 'backtest', period: '2023-24 to 2025-26', status: 'ok', n: 384,
    accuracy: 0.7161, brier: 0.1615, log_loss: 0.4712,
    baseline: { name: 'holds_a_playoff_spot', accuracy: 0.7135, brier: 0.224 },
    calibration: cal([0, 0.03, 0.02, 60], [9, 0.97, 1.0, 40]),
    recent: [], note: 'Preseason, Nov 15, Jan 1 and Mar 1 snapshots each season.',
  },
}
const pending = model => ({ model, kind: 'live', period: '2026-27', status: 'pending', n: 0, accuracy: null, brier: null, log_loss: null, baseline: null, calibration: [], recent: [] })

const PRESEASON = {
  updatedAt: '2026-09-14T00:48:27Z',
  models: Object.fromEntries(Object.entries(BACKTEST).map(([m, bt]) => [m, { live: pending(m), backtest: bt }])),
}

const GRADED = {
  ...PRESEASON,
  models: {
    ...PRESEASON.models,
    game_winner: {
      backtest: BACKTEST.game_winner,
      live: {
        ...pending('game_winner'), status: 'ok', n: 42, accuracy: 0.5952, brier: 0.2371, log_loss: 0.667,
        baseline: { name: 'home_team_wins', accuracy: 0.5238, brier: 0.2494 },
        calibration: cal([5, 0.56, 0.58, 20]),
        recent: [
          { game_id: 2026020040, game_date: '2026-10-03', home: 'CAR', away: 'OTT', home_win_prob: 0.62, winner: 'CAR', hit: true },
          { game_id: 2026020041, game_date: '2026-10-03', home: 'NYR', away: 'BOS', home_win_prob: 0.58, winner: 'BOS', hit: false },
        ],
      },
    },
  },
}

function openScorecard(body) {
  cy.intercept('GET', '**/scorecard', body).as('scorecard')
  cy.visit('/league')
  cy.get('[role="tab"]').contains('Scorecard').click()
  cy.wait('@scorecard')
}

describe('League page — Scorecard tab', () => {
  it('shows each model with its backtest and baseline, and live records pending before opening night', () => {
    openScorecard(PRESEASON)
    cy.get('.prediction-scorecard').should('contain', 'Prediction scorecard')
    cy.get('.scorecard-model').should('have.length', 3)
    cy.get('.scorecard-model[data-model="game_winner"]').within(() => {
      cy.contains('Game winners').should('exist')
      cy.get('.scorecard-pending').should('contain', 'The live record starts with opening night.')
      cy.get('.scorecard-backtest').should('contain', 'Backtest · 2023-24 to 2025-26')
        .and('contain', '56.5%').and('contain', '0.242').and('contain', '3,936 graded')
      cy.get('.scorecard-backtest .scorecard-baseline').should('contain', 'the home team wins').and('contain', '54.2%')
    })
    cy.get('.scorecard-model[data-model="starting_goalie"] .scorecard-backtest').should('contain', '73.9%').and('contain', "last game's starter starts")
  })

  it('says plainly when the edge is in the percentages, not the picks (playoff odds)', () => {
    openScorecard(PRESEASON)
    cy.get('.scorecard-model[data-model="playoff_odds"]').within(() => {
      cy.get('.scorecard-pending').should('contain', 'Graded once the regular season ends')
      cy.get('.scorecard-backtest .scorecard-edge').should('contain', 'the edge is in how closely the percentages match reality')
    })
    cy.get('.scorecard-model[data-model="game_winner"] .scorecard-edge').should('not.exist')
  })

  it('shows a graded live record with the latest picks', () => {
    openScorecard(GRADED)
    cy.get('.scorecard-model[data-model="game_winner"] .scorecard-live').within(() => {
      cy.get('.scorecard-accuracy').should('contain', '59.5%')
      cy.contains('42 graded').should('exist')
      cy.get('.scorecard-recent-item').should('have.length', 2)
      cy.get('.scorecard-recent-item').first().should('contain', 'OTT @ CAR').and('contain', 'CAR 62%').and('contain', 'CAR won').and('contain', '✓')
      cy.get('.scorecard-recent-item').eq(1).should('contain', 'BOS @ NYR').and('contain', 'NYR 58%').and('contain', '✗')
    })
  })

  it('shows an unavailable state when the Worker fails', () => {
    openScorecard({ statusCode: 502, body: {} })
    cy.get('.prediction-scorecard').should('contain', "The scorecard isn't available right now.")
  })
})
