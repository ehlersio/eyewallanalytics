// cypress/e2e/hockeytech-playoff-odds.cy.js
// Team › Overview "Playoff odds" for the AHL, ECHL and PWHL (contract C10;
// LeaguePlayoffOddsCard.jsx) from a stubbed /{league}/playoff-odds. The
// routes had no run yet when this was written, so the answers are made up
// in the route's shape: a verified format (PWHL 2026-27, conferences, so
// no division number), a verified division format (AHL), and AHL/ECHL
// 2026-27 as they really are now -- format 'unverified', projected points
// only. The team's own record comes from the live Worker.

import { LEAGUES, visitAs } from '../support/hockeytech'

const odds = over => ({
  latest: {
    season_id: 1, team_id: 1, run_date: '2026-12-10', make_playoffs_pct: 0.6412, win_division_pct: 0.2133,
    proj_points_p10: 74, proj_points_p50: 82, proj_points_p90: 90, current_points: 20, games_remaining: 56,
    sims: 10000, format: 'Top 4 in each division (points %)', ...over,
  },
  history: [
    { run_date: '2026-12-08', make_playoffs_pct: 0.55, proj_points_p50: 79 },
    { run_date: '2026-12-09', make_playoffs_pct: 0.61, proj_points_p50: 81 },
    { run_date: '2026-12-10', make_playoffs_pct: 0.6412, proj_points_p50: 82 },
  ],
  stale: false,
})
const unverified = () => {
  const o = odds({ make_playoffs_pct: null, win_division_pct: null, format: 'unverified' })
  o.history = o.history.map(h => ({ ...h, make_playoffs_pct: null }))
  return o
}

LEAGUES.forEach(({ key, label, team }) => {
  const workerUrl = Cypress.expose('WORKER_URL')
  const stub = body => cy.intercept('GET', `${workerUrl}/${key}/playoff-odds*`, body).as('odds')

  describe(`${label} Team › Overview: playoff odds`, () => {
    it('shows the playoff and division chances, projected points with their range, and the trend', () => {
      stub(odds())
      visitAs(`/${key}/team`, key, team)
      cy.wait('@odds').its('request.url').should('contain', `teamId=${team.teamId}`)
      cy.get('.league-playoff-odds', { timeout: DATA_TIMEOUT }).within(() => {
        cy.get('.playoff-odds-main').should('contain', '64%')
        cy.get('.playoff-odds-division').should('contain', '21%')
        cy.get('.playoff-odds-points').should('contain', '82').and('contain', '74–90')
        cy.get('.playoff-odds-now').should('contain', '20 pts now').and('contain', '56 games left')
        cy.get('.playoff-odds-trend svg').should('exist')
        cy.get('.playoff-odds-unverified').should('not.exist')
        cy.contains('10,000 simulations').should('exist')
      })
    })

    it(`shows projected points only while the ${label}'s format is unverified`, () => {
      stub(unverified())
      visitAs(`/${key}/team`, key, team)
      cy.get('.league-playoff-odds', { timeout: DATA_TIMEOUT }).within(() => {
        cy.get('.playoff-odds-unverified').should('contain', `${label}'s playoff format for this season isn't confirmed yet`)
        cy.get('.playoff-odds-main').should('not.exist')
        cy.get('.playoff-odds-division').should('not.exist')
        cy.get('.playoff-odds-points').should('contain', '82').and('contain', '74–90')
        cy.get('.playoff-odds-trend svg').should('exist')
      })
    })

    it('says when the odds have stopped updating', () => {
      stub({ ...odds(), stale: true })
      visitAs(`/${key}/team`, key, team)
      cy.get('.league-playoff-odds .playoff-odds-stale', { timeout: DATA_TIMEOUT }).should('contain', 'Not updated since Dec 10')
      cy.get('.league-playoff-odds .playoff-odds-early').should('not.exist')
    })

    it('has no card before the first nightly run', () => {
      stub({ latest: null, history: [] })
      visitAs(`/${key}/team`, key, team)
      cy.wait('@odds')
      cy.get('.team-view .card', { timeout: DATA_TIMEOUT }).should('have.length.at.least', 1)
      cy.get('.league-playoff-odds').should('not.exist')
    })
  })
})

// Real AHL 2026-27 (94): Hershey had played 2 games on 2026-10-08, under
// the NHL's 20-game threshold.
describe('AHL Team › Overview: early-season odds', () => {
  it('notes that early-season odds lean on last season’s ratings', () => {
    const hershey = LEAGUES.find(l => l.key === 'ahl').team
    cy.intercept('GET', `${Cypress.expose('WORKER_URL')}/ahl/playoff-odds*`, odds({ season_id: 94 })).as('odds')
    visitAs('/ahl/team', 'ahl', hershey)
    cy.get('.league-playoff-odds .playoff-odds-early', { timeout: DATA_TIMEOUT }).should('contain', 'Early season')
  })
})

describe('PWHL Team › Overview: playoff odds', () => {
  beforeEach(() => cy.setPWHLTeam('BOS'))

  it('shows the playoff chance with no division number (the PWHL plays in conferences)', () => {
    cy.intercept('GET', '**/pwhl/playoff-odds*', odds({ win_division_pct: null, format: '8 of 12: top 4 in each conference (points %)' })).as('odds')
    cy.visit('/pwhl/team')
    cy.wait('@odds').its('request.url').should('contain', 'teamId=1')
    cy.get('.league-playoff-odds', { timeout: DATA_TIMEOUT }).within(() => {
      cy.get('.playoff-odds-main').should('contain', '64%')
      cy.get('.playoff-odds-division').should('not.exist')
      cy.get('.playoff-odds-points').should('contain', '82')
    })
  })

  it('has no card before the first nightly run', () => {
    cy.intercept('GET', '**/pwhl/playoff-odds*', { latest: null, history: [] }).as('odds')
    cy.visit('/pwhl/team')
    cy.wait('@odds')
    cy.get('.league-playoff-odds').should('not.exist')
  })
})
