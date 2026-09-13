// cypress/e2e/nhl-transactions.cy.js
// NHL Transactions tab on the News view (2026-09). The Worker's
// /transactions route is stubbed with cy.intercept so these assertions
// don't depend on which moves ESPN happened to post today -- the route's
// own query/pairing/caching logic is covered by eyewall-poller's Vitest
// suite (transactions.test.js, nhl-routes.test.js). Fixture descriptions
// are verbatim ESPN text.

const TEAM_FEED = {
  scope: 'team',
  team: 'CAR',
  items: [
    {
      kind: 'move', date: '2026-09-10', team: 'CAR', category: 'signing', categories: ['signing'], counterparties: [],
      description: 'Signed D Mike Reilly to a one-year contract.',
    },
    {
      kind: 'trade', date: '2026-06-27', teams: ['CAR', 'ANA'],
      sides: [
        { team: 'CAR', description: 'Acquired D John Carlson from Anaheim in exchange for D Kyle Masters and a 2026 sixth-round pick (No. 162).' },
        { team: 'ANA', description: 'Acquired D Kyle Masters and a 2026 sixth-round pick (No. 162) from Carolina Hurricanes for D John Carlson.' },
      ],
    },
  ],
}

const LEAGUE_FEED = {
  scope: 'league',
  team: null,
  items: [
    {
      kind: 'move', date: '2026-09-12', team: 'TOR', category: 'signing', categories: ['signing'], counterparties: [],
      description: 'Signed D Nick Blankenburg to PTO.',
    },
  ],
}

function openTransactionsTab() {
  cy.visit('/news')
  cy.get('button').contains(/^Transactions$/).click()
}

describe('NHL Transactions tab', () => {
  beforeEach(() => {
    cy.intercept('GET', '**/transactions?team=*', TEAM_FEED).as('teamFeed')
    cy.intercept('GET', '**/transactions?scope=league', LEAGUE_FEED).as('leagueFeed')
  })

  it('opens on the selected team and renders one card per item', () => {
    openTransactionsTab()
    cy.wait('@teamFeed')
    cy.get('.tx-item').should('have.length', 2)
    cy.contains('2 recent').should('exist')
    cy.contains('Source: ESPN').should('exist')
  })

  it('renders a paired trade as one card with both sides', () => {
    openTransactionsTab()
    cy.wait('@teamFeed')
    cy.get('.tx-trade').should('have.length', 1).within(() => {
      cy.contains('Trade').should('exist')
      cy.contains('CAR:').should('exist')
      cy.contains('ANA:').should('exist')
      cy.contains('John Carlson').should('exist')
    })
  })

  it('shows a category badge and the description on a single move', () => {
    openTransactionsTab()
    cy.wait('@teamFeed')
    cy.get('.tx-move').first().within(() => {
      cy.contains('Signing').should('exist')
      cy.contains('Signed D Mike Reilly').should('exist')
    })
  })

  it('switches to the league-wide feed', () => {
    openTransactionsTab()
    cy.wait('@teamFeed')
    cy.get('.tx-scope-btn').contains('League').click()
    cy.wait('@leagueFeed')
    cy.get('.tx-scope-btn').contains('League').should('have.attr', 'aria-pressed', 'true')
    cy.get('.tx-item').should('have.length', 1)
    cy.contains('Nick Blankenburg').should('exist')
  })

  it('shows the empty state when there are no moves', () => {
    cy.intercept('GET', '**/transactions?team=*', { scope: 'team', team: 'CAR', items: [] }).as('emptyFeed')
    openTransactionsTab()
    cy.wait('@emptyFeed')
    cy.contains('No transactions found yet.').should('exist')
  })

  it('shows the error state when the Worker is unavailable', () => {
    cy.intercept('GET', '**/transactions?team=*', { statusCode: 502, body: {} }).as('failedFeed')
    openTransactionsTab()
    cy.wait('@failedFeed')
    cy.contains('Transactions not available').should('exist')
  })
})
