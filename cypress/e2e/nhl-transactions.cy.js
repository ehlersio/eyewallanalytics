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
      kind: 'trade', ids: [1, 2], date: '2026-06-27', teams: ['CAR', 'ANA'],
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

// /trades/tree for the trade above (eyewall-pipeline's trade_trees.py output
// shape): Masters was traded on, the pick became a drafted player, and
// Carlson arrived in Anaheim in an earlier trade.
const ROOT = 'aaaaaaaaaaaaaaaa'
const NEXT = 'bbbbbbbbbbbbbbbb'
const pick = (extra) => ({
  year: null, round: null, conditional: false, overall: null, originalTeam: null, uncertain: false, raw: null,
  note: null, resolvedYear: null, resolvedOverall: null, draftedName: null, draftedId: null, ...extra,
})
const TREE = {
  found: true, root: ROOT, truncated: false,
  trades: {
    [ROOT]: {
      id: ROOT, date: '2026-06-27', teams: ['ANA', 'CAR'], via: [], descriptions: [],
      sides: [
        { team: 'ANA', received: [
          { type: 'player', from: 'CAR', to: 'ANA', next: NEXT, name: 'Kyle Masters', position: 'D', rights: false, playerId: null },
          { type: 'pick', from: 'CAR', to: 'ANA', next: null, pick: pick({ year: 2026, round: 6, overall: 162, resolvedYear: 2026, resolvedOverall: 162, draftedName: 'Test Prospect' }) },
        ] },
        { team: 'CAR', received: [
          { type: 'player', from: 'ANA', to: 'CAR', next: null, name: 'John Carlson', position: 'D', rights: false, playerId: 8474590 },
        ] },
      ],
    },
    [NEXT]: {
      id: NEXT, date: '2026-07-15', teams: ['ANA', 'TOR'], via: [], descriptions: [],
      sides: [
        { team: 'ANA', received: [
          { type: 'pick', from: 'TOR', to: 'ANA', next: null, pick: pick({ year: 2028, round: 3, conditional: true, note: 'future' }) },
        ] },
        { team: 'TOR', received: [
          { type: 'player', from: 'ANA', to: 'TOR', next: null, name: 'Kyle Masters', position: 'D', rights: false, playerId: null },
        ] },
      ],
    },
  },
  origins: [{ id: 'cccccccccccccccc', date: '2025-03-01', teams: ['ANA', 'WSH'], assets: [
    { type: 'player', from: 'WSH', to: 'ANA', next: ROOT, name: 'John Carlson', position: 'D', rights: false, playerId: 8474590 },
  ] }],
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

  it('opens a trade tree from a paired trade and closes it again', () => {
    cy.intercept('GET', '**/trades/tree?tx=1', TREE).as('tree')
    openTransactionsTab()
    cy.wait('@teamFeed')
    cy.get('.tx-trade .tx-tree-btn').should('have.attr', 'aria-expanded', 'false').click()
    cy.wait('@tree')
    cy.get('.trade-tree').within(() => {
      cy.contains('CAR received').should('exist')
      cy.contains('ANA received').should('exist')
      cy.contains('D John Carlson').should('exist')
      cy.contains('became #162 Test Prospect').should('exist')
      cy.contains('traded to TOR for').should('exist')
      cy.contains('2028 round 3 pick (conditional)').should('exist')
      cy.contains('not drafted yet').should('exist')
      cy.contains('How they got here').should('exist')
      cy.contains('to ANA from WSH').should('exist')
    })
    cy.get('.tx-trade .tx-tree-btn').should('have.attr', 'aria-expanded', 'true').click()
    cy.get('.trade-tree').should('not.exist')
  })

  it('shows the not-found state when a trade has no tree yet', () => {
    cy.intercept('GET', '**/trades/tree?tx=1', { found: false, root: null, trades: {}, origins: [], truncated: false }).as('noTree')
    openTransactionsTab()
    cy.wait('@teamFeed')
    cy.get('.tx-trade .tx-tree-btn').click()
    cy.wait('@noTree')
    cy.contains('No trade tree for this one yet').should('exist')
  })

  it('offers a tree on an unpaired trade entry but not on other moves', () => {
    cy.intercept('GET', '**/transactions?team=*', {
      scope: 'team', team: 'CAR', items: [
        { kind: 'move', id: 7, date: '2026-06-30', team: 'CAR', category: 'trade', categories: ['trade'], counterparties: ['UTA'],
          description: 'Acquired a conditional third-round draft pick from Utah in exchange for F Juha Jaaska.' },
        TEAM_FEED.items[0],
      ],
    }).as('mixedFeed')
    cy.intercept('GET', '**/trades/tree?tx=7', TREE).as('moveTree')
    openTransactionsTab()
    cy.wait('@mixedFeed')
    cy.get('.tx-move').eq(1).find('.tx-tree-btn').should('not.exist')
    cy.get('.tx-move').eq(0).find('.tx-tree-btn').click()
    cy.wait('@moveTree')
    cy.get('.trade-tree').should('exist')
  })

  it('shows the error state when the Worker is unavailable', () => {
    cy.intercept('GET', '**/transactions?team=*', { statusCode: 502, body: {} }).as('failedFeed')
    openTransactionsTab()
    cy.wait('@failedFeed')
    cy.contains('Transactions not available').should('exist')
  })
})
