// cypress/e2e/cap-tab.cy.js
// The Team page's Cap tab for any NHL team, fed by the Worker's /contracts
// route over the open nhl-contracts dataset (stubbed here with the real
// 2026-10-24 payloads for CAR and TOR), the hidden-tab case (`unavailable`)
// and the player popup's contract panel (/contracts/player/:id). GET stubs
// go through cy.intercept; only non-GET stubs need answerInPage.js.

const contractsFor = (team) => ({ method: 'GET', url: new RegExp(`/contracts\\?team=${team}(&|$)`) })
const rosterFor    = (team) => ({ method: 'GET', url: new RegExp(`/roster\\?team=${team}(&|$)`) })

// A roster the Cap tab reads names from (dataset names can carry a prefix:
// "Hurricanes.Andrei Svechnikov"); the Worker's /roster shape.
const CAR_ROSTER = {
  forwards: [{ id: 8480830, firstName: { default: 'Andrei' }, lastName: { default: 'Svechnikov' }, positionCode: 'L' }],
  defensemen: [], goalies: [],
}

const UNAVAILABLE = (team) => ({
  team, season: '2026-27', asOf: null, rosterKnown: true, rows: [], missing: [],
  summary: { rosterCapHit: 0, rosterCount: 0, rosterWithFigure: 0, rosterWithoutFigure: 0, offRosterCount: 0, capLimits: null, expiring: { ufa: 0, rfa: 0, unknown: 0 } },
  unavailable: true,
})

const openCapTab = () => {
  cy.contains('button', /^Cap$/, { timeout: DATA_TIMEOUT }).click()
  cy.get('.cap-tab', { timeout: DATA_TIMEOUT }).should('exist')
}

describe('Cap tab (any NHL team)', () => {
  it('CAR: roster cap hit against the ceiling, provenance, rows, markers and the expiring note', () => {
    cy.intercept(contractsFor('CAR'), { fixture: 'contracts-car-2026-27.json' }).as('contracts')
    cy.intercept(rosterFor('CAR'), CAR_ROSTER)
    cy.setTeam('CAR')
    cy.visit('/team')
    cy.wait('@contracts')
    openCapTab()

    cy.contains('.cap-tab .sec-label', 'Salary Cap · 2026-27')
    cy.contains('.cap-roster-hit', '$88.2M roster cap hit')
    cy.contains('.cap-tab', 'Cap ceiling: $104.0M')
    cy.contains('.cap-tab', '23 of 25 roster players have a public figure')
    // Provenance counts `official` (tiers A-C) across every row, roster or not.
    cy.fixture('contracts-car-2026-27').then(f => {
      const official = f.rows.filter(r => r.official).length
      cy.contains('.cap-provenance', `as of Oct 24, 2026 · ${official} official / ${f.rows.length - official} reported`)
    })
    // No "cap space" anywhere: not computable from this dataset.
    cy.get('.cap-tab').should('not.contain', 'cap space')

    cy.contains('.cap-row', 'Sebastian Aho').should('contain', '$9.75M').and('contain', 'UFA').and('contain', '2031-32')
    // Roster name wins over the dataset's prefixed name.
    cy.contains('.cap-row', 'Andrei Svechnikov').should('exist')
    cy.get('.cap-tab').should('not.contain', 'Hurricanes.')
    // A roster player whose terms aren't public is listed, not dropped.
    cy.contains('.cap-row', 'Seth Jarvis').should('contain', 'no public figure')
    // Age-derived UFA/RFA carries the † marker; a reported (tier D/E) row the ≈ marker.
    cy.contains('.cap-row', 'Jaccob Slavin').should('contain', 'UFA†')
    cy.contains('.cap-row', 'Sebastian Aho').should('not.contain', '†')
    cy.fixture('contracts-car-2026-27').then(f => {
      const reported = f.rows.find(r => ['D', 'E'].includes(r.tier) && r.onRoster && r.capHit != null)
      cy.get(`.cap-row[data-player-id="${reported.playerId}"]`).should('contain', '≈')
    })
    cy.contains('.cap-tab', 'UFA/RFA derived from age')
    // Deals the team signed for players off its roster sit under their own header.
    cy.contains('.cap-off-roster', '9 deals signed by the team, players off the roster')
    cy.contains('.cap-row', 'Mike Reilly').should('exist')
    cy.contains('.cap-expiring', '8 UFAs and 1 RFA expiring this summer')
  })

  it('TOR: the same tab for another team, with reported figures marked', () => {
    cy.intercept(contractsFor('TOR'), { fixture: 'contracts-tor-2026-27.json' }).as('contracts')
    cy.setTeam('TOR')
    cy.visit('/team')
    cy.contains('Toronto Maple Leafs').should('be.visible')
    cy.wait('@contracts')
    openCapTab()
    cy.contains('.cap-roster-hit', '$86.2M roster cap hit')
    cy.contains('.cap-tab', '23 of 27 roster players have a public figure')
    cy.contains('.cap-row', 'Auston Matthews').should('contain', '$13.25M').and('contain', '≈')
    cy.contains('.cap-row', 'William Nylander').should('contain', '$11.50M').and('not.contain', '≈')
    cy.contains('.cap-expiring', '5 UFAs and 2 RFAs expiring this summer')
  })

  it('hides the Cap tab when the route answers unavailable (no dead options)', () => {
    cy.intercept(contractsFor('VGK'), UNAVAILABLE('VGK')).as('contracts')
    cy.setTeam('VGK')
    cy.visit('/team')
    cy.contains('Vegas Golden Knights').should('be.visible')
    cy.wait('@contracts')
    cy.contains('button', 'Picks').should('be.visible')
    cy.contains('button', /^Cap$/).should('not.exist')
  })

  it('hides the Cap tab while the Worker is unreachable', () => {
    cy.intercept(contractsFor('CAR'), { statusCode: 503, body: {} }).as('contracts')
    cy.setTeam('CAR')
    cy.visit('/team')
    cy.wait('@contracts')
    cy.contains('button', 'Picks').should('be.visible')
    cy.contains('button', /^Cap$/).should('not.exist')
  })
})

describe('Player popup contract panel', () => {
  const openSkater = (lastName) => {
    cy.visit('/players')
    cy.get('.pc-last', { timeout: DATA_TIMEOUT }).should('exist')
    cy.contains('.player-card', lastName, { timeout: DATA_TIMEOUT }).click()
    cy.get('.pp-tab', { timeout: DATA_TIMEOUT }).should('exist')
  }

  it('shows cap hit, AAV, expiry, years left, % of cap, clauses and provenance by playerId', () => {
    cy.intercept({ method: 'GET', url: /\/contracts\/player\/8478427(\?|$)/ }, { fixture: 'contract-player-aho.json' }).as('contract')
    cy.setTeam('CAR')
    openSkater('Aho')
    cy.wait('@contract')
    cy.get('.pp-contract', { timeout: DATA_TIMEOUT }).within(() => {
      cy.contains('Cap Hit').parent().should('contain', '$9.75M')
      cy.contains('AAV / Year').parent().should('contain', '$9.75M')
      cy.contains('Expires After').parent().should('contain', '2031-32')
      cy.contains('Status').parent().should('contain', 'UFA')
      cy.contains('Yrs Left').parent().should('contain', '5')
      cy.contains('% of Cap').parent().should('contain', '9.4%')
      cy.get('.pp-contract-clauses').should('contain', 'No-move').and('contain', '2024-25–2031-32').and('contain', 'Modified no-trade')
      cy.get('.pp-contract-provenance').should('contain', 'Official source').and('contain', 'tier C')
    })
  })

  it('marks an age-derived expiry status', () => {
    cy.intercept({ method: 'GET', url: /\/contracts\/player\/8476958(\?|$)/ }, { fixture: 'contract-player-slavin.json' }).as('contract')
    cy.setTeam('CAR')
    openSkater('Slavin')
    cy.wait('@contract')
    cy.get('.pp-contract', { timeout: DATA_TIMEOUT }).within(() => {
      cy.contains('Cap Hit').parent().should('contain', '$6.40M')
      cy.contains('AAV / Year').parent().should('contain', '$6.46M')
      cy.contains('Status').parent().should('contain', 'UFA†')
      cy.get('.pp-contract-provenance').should('contain', 'derived from age')
    })
  })

  it('renders no contract panel when the dataset has nothing for the player', () => {
    cy.intercept({ method: 'GET', url: /\/contracts\/player\/\d+(\?|$)/ }, {
      playerId: 8478427, season: '2026-27', asOf: null, current: null, history: [], unavailable: true,
    }).as('contract')
    cy.setTeam('CAR')
    openSkater('Aho')
    cy.wait('@contract')
    cy.get('.pp-body', { timeout: DATA_TIMEOUT }).should('exist')
    cy.get('.pp-contract').should('not.exist')
  })
})
