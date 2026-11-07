// cypress/e2e/trade-candidacy.cy.js
// Candidate signals in the NHL player popup and League › Cap's Deadline
// board, fed by the Worker's /trade-candidacy and /trade-candidacy/board
// (eyewall-pipeline trade_candidacy.py), stubbed with eyewall-pipeline's dry
// run as of 2027-01-01 shaped by the Worker's own helpers. Both exist only
// from Jan 1 to the trade deadline; outside it the routes return nothing and
// neither is shown. GET stubs go through cy.intercept.

const candidacyFor = (id) => ({ method: 'GET', url: new RegExp(`/trade-candidacy\\?player=${id}(&|$)`) })
const BOARD = { method: 'GET', url: /\/trade-candidacy\/board(\?|$)/ }
const ROSTER_SUMMARY = { method: 'GET', url: /\/contracts\/summary\?.*basis=roster/ }
const EMPTY_BOARD = { players: [], asOf: null, deadline: null, generatedAt: null, fitTeam: 'CAR' }

const openSkater = (lastName) => {
  cy.visit('/players')
  cy.get('.pc-last', { timeout: DATA_TIMEOUT }).should('exist')
  cy.contains('.player-card', lastName, { timeout: DATA_TIMEOUT }).click()
  cy.get('.pp-tab', { timeout: DATA_TIMEOUT }).should('exist')
}

const openCap = () => {
  cy.intercept(ROSTER_SUMMARY, { fixture: 'contracts-summary-roster-2026-27.json' }).as('roster')
  cy.visit('/league')
  cy.wait('@roster')
  cy.get('.league-tab').contains(/^Cap$/, { timeout: DATA_TIMEOUT }).click()
}

describe('Player popup Candidate signals', () => {
  it('Greenway: tier, signals and clause, never a percentage', () => {
    cy.intercept(candidacyFor(8478413), { fixture: 'trade-candidacy-greenway-2027-01-01.json' }).as('cand')
    cy.setTeam('CHI')
    openSkater('Greenway')
    cy.wait('@cand')
    cy.get('.trade-candidacy', { timeout: DATA_TIMEOUT }).should('have.attr', 'data-tier', 'several').within(() => {
      cy.contains('.sec-label', 'Candidate signals')
      cy.contains('.trade-candidacy-tier', 'Several signals')
      cy.contains('.trade-candidacy-asof', 'As of Jan 1 · trade deadline Mar 1')
      cy.get('.trade-candidacy-signal').should('have.length', 2)
      cy.get('.trade-candidacy-signal[data-code="expiring"]').should('contain', 'Contract ends this season (UFA)')
      cy.get('.trade-candidacy-signal[data-code="outside_playoffs"]').should('contain', 'Team is 15th in the West')
      cy.contains('.trade-candidacy-clause', 'Modified no-trade clause: up to 5 teams may be blocked')
    })
    cy.get('.trade-candidacy .trade-candidacy-tier').invoke('text').should('not.match', /%/)
  })

  it('shows no section for an untiered player or outside Jan 1 - deadline', () => {
    cy.intercept(candidacyFor(8478427), { player: null, asOf: null, deadline: null, generatedAt: null }).as('cand')
    cy.setTeam('CAR')
    openSkater('Aho')
    cy.wait('@cand')
    cy.get('.pp-tab').should('exist')
    cy.get('.trade-candidacy').should('not.exist')
  })
})

describe('League › Cap Deadline board', () => {
  it('ranks players with tiers and signals, filters by position, and opens the popup', () => {
    cy.intercept(BOARD, { fixture: 'trade-candidacy-board-2027-01-01.json' }).as('board')
    openCap()
    cy.wait('@board').its('request.url').should('match', /fit=[A-Z]{2,3}/)
    cy.fixture('trade-candidacy-board-2027-01-01').then(f => {
      cy.get('.deadline-board', { timeout: DATA_TIMEOUT }).within(() => {
        cy.contains('.sec-label', 'Deadline board')
        cy.contains('.deadline-board-note', `${f.players.length} players with candidate signals · as of Jan 1 · deadline Mar 1`)
        cy.get('.deadline-board-row').should('have.length', 25)
        cy.get('.deadline-board-row').first().should('contain', 'Jordan Greenway').and('contain', 'Several signals').and('contain', '$4.00M')
        // the fixture was fetched without a fit team: no fit filter is offered
        cy.get('.deadline-board-fit').should('not.exist')
        cy.get('.deadline-board-seg[data-group="defense"]').click()
        const d = f.players.filter(p => p.position === 'D')
        cy.get('.deadline-board-row').should('have.length', Math.min(25, d.length))
        cy.get('.deadline-board-row').first().should('contain', d[0].name)
        cy.get('.deadline-board-seg[data-group="all"]').click()
        cy.contains('.deadline-board-more', `Show all ${f.players.length}`).click()
        cy.get('.deadline-board-row').should('have.length', f.players.length)
      })
    })
    cy.get('.deadline-board-row').first().click()
    cy.get('.pp-tab', { timeout: DATA_TIMEOUT }).should('exist')
  })

  it('offers "Fits" only when the selected team fits someone', () => {
    cy.fixture('trade-candidacy-board-2027-01-01').then(f => {
      const players = f.players.map((p, i) => ({ ...p, fit: i % 5 === 0 ? 'strong' : 'long_shot' }))
      cy.intercept(BOARD, { ...f, fitTeam: 'CAR', players }).as('board')
      openCap()
      cy.wait('@board')
      cy.get('.deadline-board-fit', { timeout: DATA_TIMEOUT }).should('contain', 'Fits CAR').click()
      cy.get('.deadline-board-row').should('have.length', Math.min(25, players.filter(p => p.fit === 'strong').length))
      cy.get('.deadline-board-row').first().should('contain', players[0].name)
    })
  })

  it('is not shown outside Jan 1 - the deadline', () => {
    cy.intercept(BOARD, EMPTY_BOARD).as('board')
    openCap()
    cy.wait('@board')
    cy.get('.league-cap', { timeout: DATA_TIMEOUT }).should('exist')
    cy.get('.deadline-board').should('not.exist')
  })
})
