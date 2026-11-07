// cypress/e2e/team-needs.cy.js
// The Team page's Needs tab, fed by the Worker's /team-needs (eyewall-pipeline
// team_needs.py), stubbed with real 2026-11-06 payloads for STL (four slots
// in the league's bottom third) and CAR (none, one unranked slot), plus the
// hidden-tab cases: no slots (offseason) and `unavailable`. GET stubs go
// through cy.intercept.

const needsFor = (team) => ({ method: 'GET', url: new RegExp(`/team-needs\\?team=${team}(&|$)`) })

const openNeedsTab = () => {
  cy.contains('button', /^Needs$/, { timeout: DATA_TIMEOUT }).click()
  cy.get('.needs-tab', { timeout: DATA_TIMEOUT }).should('exist')
}

describe('Needs tab (any NHL team)', () => {
  it('STL: bottom-third slots summarized worst first, ranks, right shots', () => {
    cy.intercept(needsFor('STL'), { fixture: 'team-needs-stl-2026-11-06.json' }).as('needs')
    cy.setTeam('STL')
    cy.visit('/team')
    cy.wait('@needs')
    openNeedsTab()

    cy.contains('.needs-summary', 'Weakest against the league: Top-4 defense, Backup goalie, Bottom-6 wingers, Top-6 wingers')
    cy.get('.needs-slot[data-slot="D_TOP4"]')
      .should('contain', 'Rank 32 of 32')
      .and('contain', 'bottom third')
      .and('contain', '3 right shots')
    cy.get('.needs-slot[data-slot="F_TOP6_C"]').should('contain', 'Rank 10 of 31').and('not.contain', 'bottom third')
    cy.get('.needs-group-goalies .needs-slot').should('have.length', 2)
    cy.contains('.needs-basis', 'Lineup from the projected lines for the next game')
  })

  it('CAR: no needs, an unranked third pair with an unrated player, last-season labels', () => {
    cy.intercept(needsFor('CAR'), { fixture: 'team-needs-car-2026-11-06.json' }).as('needs')
    cy.setTeam('CAR')
    cy.visit('/team')
    cy.wait('@needs')
    openNeedsTab()

    cy.contains('.needs-summary', "No slot ranks in the league's bottom third.")
    cy.get('.needs-slot[data-slot="D_BOT2"]')
      .should('contain', 'not ranked')
      .and('contain', 'Too few rated players to rank (1 of 2)')
      .and('contain', 'unrated')
    cy.get('.needs-slot[data-slot="D_TOP4"]').contains('.needs-player', 'Jaccob Slavin')
      .should('contain', '+0.50')
      .and('contain', 'last season')
  })

  it("CAR in the offseason: next season's signed roster (Phase 2b)", () => {
    cy.intercept(needsFor('CAR'), { fixture: 'team-needs-car-next-season-2027-28.json' }).as('needs')
    cy.setTeam('CAR')
    cy.visit('/team')
    cy.wait('@needs')
    openNeedsTab()
    cy.contains('.needs-basis', "2027-28 signed roster, slotted by last season's ice time")
    cy.get('.needs-slot[data-slot="F_TOP6_C"]').should('contain', 'Sebastian Aho')
  })

  it('hides the tab when there are no slots (offseason) or the route is unavailable', () => {
    cy.intercept(needsFor('CAR'), { team: 'CAR', season: null, basis: null, basisGameId: null, generatedAt: null, slots: [] }).as('empty')
    cy.setTeam('CAR')
    cy.visit('/team')
    cy.wait('@empty')
    cy.contains('button', /^Overview$/, { timeout: DATA_TIMEOUT }).should('exist')
    cy.contains('button', /^Needs$/).should('not.exist')

    cy.intercept(needsFor('CAR'), { team: 'CAR', season: null, basis: null, basisGameId: null, generatedAt: null, slots: [], unavailable: true }).as('down')
    cy.visit('/team')
    cy.wait('@down')
    cy.contains('button', /^Overview$/, { timeout: DATA_TIMEOUT }).should('exist')
    cy.contains('button', /^Needs$/).should('not.exist')
  })
})
