// cypress/e2e/league-cap.cy.js
// League › Cap: every team's contract commitments from the Worker's
// /contracts/summary (stubbed with the real 2026-10-24 payload), and the
// hidden-tab case when the route answers `unavailable` (no dead options).

const SUMMARY = { method: 'GET', url: /\/contracts\/summary(\?|$)/ }

describe('League › Cap', () => {
  it('lists every team by cap hit total with Arizona folded into Utah', () => {
    cy.intercept(SUMMARY, { fixture: 'contracts-summary-2026-27.json' }).as('summary')
    cy.visit('/league')
    cy.wait('@summary')
    cy.get('.league-tab').contains(/^Cap$/, { timeout: DATA_TIMEOUT }).click()
    cy.get('.league-cap', { timeout: DATA_TIMEOUT }).should('exist')

    cy.contains('.league-cap .sec-label', 'Contract commitments · 2026-27')
    // Says what it is and what it is not; no "cap space" figure anywhere.
    cy.contains('.league-cap', 'By signing team')
    cy.contains('.league-cap', 'Not cap space.')
    cy.get('.league-cap').invoke('text').should('not.match', /\$[\d.]+M (of )?cap space/)
    cy.contains('.league-cap-provenance', 'as of Oct 24, 2026 · cap ceiling $104.0M')

    cy.fixture('contracts-summary-2026-27').then(f => {
      const rows = [...f.teams].sort((a, b) => b.capHitTotal - a.capHitTotal)
      // 33 entries in the payload (ARI still carries running Coyotes deals) -> 32 rows
      cy.get('.league-cap-row').should('have.length', f.teams.length - 1)
      cy.get('.league-cap-row').first().should('contain', rows[0].team)
        .and('contain', `$${(rows[0].capHitTotal / 1e6).toFixed(1)}M`)
      const uta = f.teams.find(t => t.team === 'UTA'), ari = f.teams.find(t => t.team === 'ARI')
      cy.get('.league-cap-row[data-team="UTA"]').should('contain', '*')
        .and('contain', `$${((uta.capHitTotal + ari.capHitTotal) / 1e6).toFixed(1)}M`)
      cy.get('.league-cap-row[data-team="ARI"]').should('not.exist')
      const ufa = f.teams.reduce((s, t) => s + t.expiring.ufa, 0), rfa = f.teams.reduce((s, t) => s + t.expiring.rfa, 0)
      cy.contains('.league-cap', `Expiring this summer across the league: ${ufa} UFA · ${rfa} RFA`)
    })
    cy.contains('.league-cap', 'includes deals signed as Arizona')
  })

  it('hides the Cap tab when the summary is unavailable', () => {
    cy.intercept(SUMMARY, { season: '2026-27', basis: 'signing_team', asOf: null, capLimits: null, teams: [], unavailable: true }).as('summary')
    cy.visit('/league')
    cy.wait('@summary')
    cy.get('.league-tab').contains('Draft').should('be.visible')
    cy.get('.league-tab').contains(/^Cap$/).should('not.exist')
  })
})
