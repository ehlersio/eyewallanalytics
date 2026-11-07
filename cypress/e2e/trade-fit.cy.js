// cypress/e2e/trade-fit.cy.js
// The NHL player popup's Trade fit section, fed by the Worker's /trade-fit
// (eyewall-pipeline trade_fit.py), stubbed with real 2026-11-07 payloads
// for Aho (signed through 2031-32, no-move clause) and Martinook (a rental,
// so non-contenders drop to possible / long shot), plus the hidden case
// (player outside the population). Phase 2b: the offseason fit (for next
// season, from the day after the deadline), stubbed with the pipeline's dry
// run as of 2027-03-02 for Aho (term) and Greenway (a pending UFA's rights).
// GET stubs go through cy.intercept.

const tradeFitFor = (id) => ({ method: 'GET', url: new RegExp(`/trade-fit\\?player=${id}(&|$)`) })

const openSkater = (lastName) => {
  cy.visit('/players')
  cy.get('.pc-last', { timeout: DATA_TIMEOUT }).should('exist')
  cy.contains('.player-card', lastName, { timeout: DATA_TIMEOUT }).click()
  cy.get('.pp-tab', { timeout: DATA_TIMEOUT }).should('exist')
}

describe('Player popup Trade fit', () => {
  it('Aho: tier summary, clause, top five with reasons, then all 31', () => {
    cy.intercept(tradeFitFor(8478427), { fixture: 'trade-fit-aho-2026-11-07.json' }).as('fit')
    cy.setTeam('CAR')
    openSkater('Aho')
    cy.wait('@fit')
    cy.get('.trade-fit', { timeout: DATA_TIMEOUT }).within(() => {
      cy.contains('.trade-fit-summary', 'Strong fit with 11 teams · possible with 15 · long shot for 5')
      cy.contains('.trade-fit-basis', 'signed through 2031-32')
      cy.contains('.trade-fit-clause', "No-move clause: he'd have to approve any trade.")
      cy.get('.trade-fit-team').should('have.length', 5)
      cy.get('.trade-fit-reasons').should('not.exist')
      cy.get('.trade-fit-team[data-team="DET"] .trade-fit-team-toggle').click()
      cy.get('.trade-fit-reasons').should('have.length', 1)
      cy.get('.trade-fit-team[data-team="DET"]')
        .should('contain', 'Red Wings')
        .and('contain', 'Strong fit')
        .and('contain', "Top-6 centers rank in the league's bottom third")
        .and('contain', 'Signed through 2031-32: fits any timeline')
      cy.contains('.trade-fit-toggle', 'Show all 31 teams').click()
      cy.get('.trade-fit-team').should('have.length', 31)
      cy.get('.trade-fit-team[data-tier="long_shot"]').should('have.length', 5)
      cy.contains('.trade-fit-toggle', 'Show fewer').click()
      cy.get('.trade-fit-team').should('have.length', 5)
    })
  })

  it('Martinook: a rental reads each team against the playoff-odds bar', () => {
    cy.intercept(tradeFitFor(8476921), { fixture: 'trade-fit-martinook-2026-11-07.json' }).as('fit')
    cy.setTeam('CAR')
    openSkater('Martinook')
    cy.wait('@fit')
    cy.get('.trade-fit', { timeout: DATA_TIMEOUT }).within(() => {
      cy.contains('.trade-fit-summary', 'Strong fit with 3 teams')
      cy.contains('.trade-fit-basis', 'expiring contract')
      cy.contains('.trade-fit-clause', 'No trade clause on record')
      cy.get('.trade-fit-team-toggle').first().click()
      cy.get('.trade-fit-team').first().should('contain', 'playoff odds: a rental fits')
      cy.contains('.trade-fit-toggle', 'Show all 31 teams').click()
      cy.get('.trade-fit-team[data-tier="long_shot"] .trade-fit-team-toggle').last().click()
      cy.get('.trade-fit-reasons').should('have.length', 1).and('contain', 'under the 50% bar for a rental')
    })
  })

  it("Aho in the offseason: next season's fit, its cap not in the data yet", () => {
    cy.intercept(tradeFitFor(8478427), { fixture: 'trade-fit-offseason-aho-2027-03-02.json' }).as('fit')
    cy.setTeam('CAR')
    openSkater('Aho')
    cy.wait('@fit')
    cy.get('.trade-fit', { timeout: DATA_TIMEOUT }).within(() => {
      cy.contains('.trade-fit-phase', "Offseason fit for 2027-28: next season's signed rosters, cap and contenders.")
      cy.get('.trade-fit-team-toggle').first().click()
      cy.get('.trade-fit-reasons').should('contain', "The 2027-28 cap ceiling isn't in the cap data yet")
    })
  })

  it('Greenway in the offseason: rights only, at best a possible fit', () => {
    cy.intercept(tradeFitFor(8478413), { fixture: 'trade-fit-offseason-greenway-2027-03-02.json' }).as('fit')
    cy.setTeam('CHI')
    openSkater('Greenway')
    cy.wait('@fit')
    cy.get('.trade-fit', { timeout: DATA_TIMEOUT }).within(() => {
      cy.contains('.trade-fit-basis', 'pending UFA: rights only until June 30')
      cy.get('.trade-fit-team[data-tier="strong"]').should('not.exist')
      cy.get('.trade-fit-team-toggle').first().click()
      cy.get('.trade-fit-reasons').should('contain', 'Rights only: the new team could sign him before July 1')
    })
  })

  it('shows no section for a player outside the population', () => {
    cy.intercept(tradeFitFor(8478427), { player: null, teams: [], generatedAt: null }).as('fit')
    cy.setTeam('CAR')
    openSkater('Aho')
    cy.wait('@fit')
    cy.get('.pp-tab').should('exist')
    cy.get('.trade-fit').should('not.exist')
  })
})
