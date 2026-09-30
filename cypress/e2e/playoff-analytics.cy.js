// cypress/e2e/playoff-analytics.cy.js
// Player popup Analytics tab: Regular season / Playoffs toggle (game-type
// split, 2026-09). Offered only when the player has playoff analytics
// (/player-analytics poRows); the Playoffs view shows playoff WAR, the
// playoff RAPM next to the regular-season one with the difference and the
// playoff minutes behind it, and no percentile bars. Both analytics routes
// are stubbed; Sebastian Aho (8478427) is opened from CAR's live roster.

const AHO = 8478427

function analytics(poRows) {
  return {
    rows: [{
      player_id: AHO, team: 'CAR', war: 0.87, rapm: 0.05, rapm_toi_min: 3100, games_played: 82,
      game_score: 60.1, ev_off_pct: 0.55, xgf_per60: 2.9, pct_ev_off: 80,
    }],
    poRows,
    statsStale: false,
    statsSeason: null,
  }
}

function openAhoAnalytics(poRows) {
  cy.intercept('GET', '**/player-analytics?*', analytics(poRows)).as('analytics')
  cy.setTeam('CAR')
  cy.visit('/players')
  cy.get('img[alt="Sebastian Aho"]', { timeout: 20000 }).first().click()
  cy.wait('@analytics')
  cy.get('.pp-tab').contains('Analytics').click()
}

describe('Player popup — playoff analytics', () => {
  it('offers Playoffs when there are playoff analytics, and shows them without percentiles', () => {
    openAhoAnalytics([{
      player_id: AHO, war: 0.109, rapm: 0.055, rapm_toi_min: 953, games_played: 19,
      game_score: 14.88, ev_off_pct: 0.561, xgf_per60: 3.1,
    }])
    cy.get('.pa-season-type .season-type-toggle-btn.on').should('contain', 'Regular')
    cy.get('.pa-season-type').contains('Playoffs').click()
    cy.get('.pa-playoff-war').should('contain', '+0.109').and('contain', '19 playoff GP')
    cy.get('.pa-playoff-rapm')
      .should('contain', '+0.050')   // regular season
      .and('contain', '+0.055')      // playoffs
      .and('contain', '+0.005')      // difference
      .and('contain', '953')         // playoff minutes
    cy.get('.pa-playoff-note').should('contain', 'No playoff percentiles')
    cy.assertNoErrors()
  })

  it('offers no Playoffs option when the player has none', () => {
    openAhoAnalytics([{ player_id: AHO, hits: 12 }]) // box score only
    cy.contains('WAR', { timeout: 15000 }).should('exist')
    cy.get('.pa-season-type').should('not.exist')
  })
})
