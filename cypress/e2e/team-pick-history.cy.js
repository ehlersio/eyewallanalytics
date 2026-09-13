// cypress/e2e/team-pick-history.cy.js
// "Recent drafts" card on the Team page's Picks tab (2026-09): where a team's
// last five drafts' picks came from and went. The Worker's
// /draft/pick-history route is stubbed with cy.intercept (fixture rows are
// real CAR picks from draft_pick_history), as are the Picks tab's existing
// /draft/order and /draft/picks calls, so nothing depends on live data. The
// route's own query/caching logic is covered by eyewall-poller's Vitest
// suite (nhl-routes.test.js).

const HISTORY = {
  team: 'CAR',
  sinceYear: 2022,
  made: [
    { draft_year: 2026, round: 2, pick_in_round: 19, overall_pick: 51, team: 'CAR', original_team: 'UTA', pick_chain: ['UTA', 'CGY', 'CAR'], times_traded: 2, player_id: null, player_name: 'William Hakansson', position: 'D' },
    { draft_year: 2026, round: 2, pick_in_round: 29, overall_pick: 61, team: 'CAR', original_team: 'MTL', pick_chain: ['MTL', 'CAR'], times_traded: 1, player_id: null, player_name: 'Wiggo Sorensson', position: 'C' },
    { draft_year: 2025, round: 2, pick_in_round: 9, overall_pick: 41, team: 'CAR', original_team: 'PIT', pick_chain: ['PIT', 'MTL', 'CAR'], times_traded: 2, player_id: null, player_name: 'Semyon Frolov', position: 'G' },
    { draft_year: 2025, round: 4, pick_in_round: 28, overall_pick: 124, team: 'CAR', original_team: 'CAR', pick_chain: ['CAR'], times_traded: 0, player_id: null, player_name: 'Own Pick', position: 'RW' },
  ],
  tradedAway: [
    { draft_year: 2026, round: 1, pick_in_round: 31, overall_pick: 31, team: 'NSH', original_team: 'CAR', pick_chain: ['CAR', 'NSH'], times_traded: 1, player_id: null, player_name: 'Thomas Bleyl', position: 'D' },
    { draft_year: 2026, round: 5, pick_in_round: 32, overall_pick: 160, team: 'PIT', original_team: 'CAR', pick_chain: ['CAR', 'NSH', 'PIT'], times_traded: 2, player_id: null, player_name: 'Matvei Nikonovich', position: 'LW' },
    { draft_year: 2025, round: 1, pick_in_round: 29, overall_pick: 29, team: 'CHI', original_team: 'CAR', pick_chain: ['CAR', 'CHI'], times_traded: 1, player_id: null, player_name: 'Mason West', position: 'C' },
  ],
}

function openPicksTab(historyBody) {
  cy.intercept('GET', '**/draft/order*', { body: [] })
  cy.intercept('GET', '**/draft/picks*', { body: [] })
  cy.intercept('GET', '**/draft/pick-history?team=*', historyBody).as('history')
  cy.visit('/team')
  cy.get('.team-tab').contains('Picks').click()
  cy.wait('@history')
}

describe('Team page — Picks tab, Recent drafts card', () => {
  it('summarizes trades across all five drafts and opens on the newest year', () => {
    openPicksTab(HISTORY)
    cy.get('.pick-history').within(() => {
      cy.contains('Recent drafts').should('exist')
      cy.get('.pick-history-summary').should('contain', '3 of 4').and('contain', '3').and('contain', '2025')
      cy.get('.pick-history-year').should('have.length', 2)
      cy.get('.pick-history-year').first().should('contain', '2026').and('have.attr', 'aria-pressed', 'true')
    })
  })

  it('shows where each pick made came from', () => {
    openPicksTab(HISTORY)
    cy.get('.pick-history-made').should('have.length', 2)
    cy.get('.pick-history-made').first().should('contain', 'William Hakansson').and('contain', 'via UTA → CGY')
    cy.get('.pick-history-made').eq(1).should('contain', 'via MTL')
  })

  it('shows own picks traded away, with anyone in between', () => {
    openPicksTab(HISTORY)
    cy.get('.pick-history-away').should('have.length', 2)
    cy.get('.pick-history-away').first().should('contain', '→ NSH').and('contain', 'Thomas Bleyl').and('not.contain', 'via')
    cy.get('.pick-history-away').eq(1).should('contain', '→ PIT').and('contain', 'via NSH')
  })

  it('switches years, and an untraded pick shows no origin', () => {
    openPicksTab(HISTORY)
    cy.get('.pick-history-year').contains('2025').click()
    cy.get('.pick-history-year').contains('2025').should('have.attr', 'aria-pressed', 'true')
    cy.get('.pick-history-made').should('have.length', 2)
    cy.get('.pick-history-made').contains('Own Pick').parents('.pick-history-made').should('not.contain', 'via')
    cy.get('.pick-history-away').should('have.length', 1).and('contain', '→ CHI')
  })

  it('shows an empty state when there is no history', () => {
    openPicksTab({ team: 'CAR', sinceYear: 2022, made: [], tradedAway: [] })
    cy.get('.pick-history').should('contain', 'No draft history available yet.')
  })

  it('shows an unavailable state when the Worker fails', () => {
    openPicksTab({ statusCode: 502, body: {} })
    cy.get('.pick-history').should('contain', "Draft history isn't available right now.")
  })
})
