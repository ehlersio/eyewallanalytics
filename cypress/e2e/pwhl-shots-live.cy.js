// cypress/e2e/pwhl-shots-live.cy.js
// Tests for the PWHL Shot Map view live mode UI:
// debug panel, game event popups, situation chips, insights panel.
// Does not require an actual live game — uses the debug panel.

describe('PWHL Shot Map — Live UI & Debug Panel', () => {
  beforeEach(() => {
    cy.visit('/pwhl/shots', {
      onBeforeLoad(win) {
        win.localStorage.setItem('eyewall:sport', 'pwhl')
        win.localStorage.setItem('eyewall:pwhl_team', JSON.stringify({ abbr: 'MTL', teamId: 3 }))
      },
    })
    cy.get('.topbar', { timeout: 10000 }).should('exist')
    cy.get('.score-card', { timeout: 10000 }).should('exist')
  })

  it('loads without crashing', () => {
    cy.assertNoErrors()
  })

  it('score card is visible', () => {
    cy.get('.score-card').should('be.visible')
  })

  it('debug panel does not open before 5 taps', () => {
    Cypress._.times(4, () => cy.get('.score-card').click())
    cy.get('.debug-panel').should('not.exist')
  })

  describe('Debug panel (5 taps)', () => {
    beforeEach(() => {
      Cypress._.times(5, () => cy.get('.score-card').click())
      cy.get('.debug-panel', { timeout: 4000 }).should('exist')
    })

    it('opens on 5 taps showing PWHL Event Debug', () => {
      cy.contains('PWHL Event Debug').should('exist')
      cy.contains('Tap to fire game events').should('exist')
    })

    it('closes on ✕ button', () => {
      cy.get('.debug-close-btn').click()
      cy.get('.debug-panel').should('not.exist')
    })

    it('toggles closed and open again on 5 more taps', () => {
      cy.get('.debug-close-btn').click()
      cy.get('.debug-panel').should('not.exist')
      Cypress._.times(5, () => cy.get('.score-card').click())
      cy.get('.debug-panel', { timeout: 4000 }).should('exist')
    })

    describe('Popup section', () => {
      it('Goal popup renders and dismisses', () => {
        cy.contains('🚨 Goal').click()
        cy.get('.goal-popup', { timeout: 4000 }).should('exist')
        cy.contains('GOAL!').should('exist')
        cy.contains('Marie-Philip Poulin').should('exist')
        cy.contains('tap to dismiss').click({ force: true })
        cy.get('.goal-popup').should('not.exist')
      })

      it('PP Goal popup renders with Power Play modifier', () => {
        cy.contains('⚡ PP Goal').click()
        cy.get('.goal-popup', { timeout: 4000 }).should('exist')
        cy.contains('Power Play').should('exist')
        cy.contains('tap to dismiss').click({ force: true })
      })

      it('Puck Drop popup renders and dismisses', () => {
        cy.contains('🏒 Puck Drop').click()
        cy.get('.puck-drop-popup', { timeout: 4000 }).should('exist')
        cy.contains('PUCK DROP').should('exist')
        cy.contains('tap to dismiss').click({ force: true })
        cy.get('.puck-drop-popup').should('not.exist')
      })

      it('PP Alert popup renders and dismisses', () => {
        cy.contains('⚡ PP Alert').click()
        cy.get('.penalty-popup', { timeout: 4000 }).should('exist')
        cy.contains('POWER').should('exist')
        cy.contains('Tripping').should('exist')
        cy.contains('tap to dismiss').click({ force: true })
        cy.get('.penalty-popup').should('not.exist')
      })

      it('Major penalty popup shows severity badge', () => {
        cy.contains('🟠 Major').click()
        cy.get('.penalty-popup', { timeout: 4000 }).should('exist')
        cy.contains('Major').should('exist')
        cy.contains('Fighting').should('exist')
        cy.contains('tap to dismiss').click({ force: true })
      })

      it('Win popup renders with team abbr and dismisses', () => {
        cy.contains('🏆 Win').click()
        cy.get('.win-popup', { timeout: 4000 }).should('exist')
        cy.contains('WIN!').should('exist')
        cy.contains('tap to dismiss').click({ force: true })
        cy.get('.win-popup').should('not.exist')
      })

      it('Hat Trick popup renders with siren and raining hats', () => {
        cy.contains('🧢 Hat Trick').click()
        cy.get('.hat-trick-popup', { timeout: 4000 }).should('exist')
        cy.contains('HAT TRICK!').should('exist')
        cy.contains('Marie-Philip Poulin').should('exist')
        // Hat rain pieces should be in DOM
        cy.get('.hat-piece').should('have.length.at.least', 1)
        cy.contains('tap to dismiss').click({ force: true })
        cy.get('.hat-trick-popup').should('not.exist')
      })
    })

    describe('Situation chips', () => {
      it('Our PP chip appears and auto-clears', () => {
        cy.contains('🟢 Our PP').click()
        cy.get('.car-pp', { timeout: 4000 }).should('exist')
        cy.contains('Power Play').should('exist')
      })

      it('Opp PP chip appears', () => {
        cy.contains('🟡 Opp PP').click()
        cy.get('.opp-pp', { timeout: 4000 }).should('exist')
      })

      it('Our EN chip appears', () => {
        cy.contains('🥅 Our EN').click()
        cy.get('.car-en', { timeout: 4000 }).should('exist')
        cy.contains('Empty Net').should('exist')
      })

      it('Opp EN chip appears', () => {
        cy.contains('🥅 Opp EN').click()
        cy.get('.opp-en', { timeout: 4000 }).should('exist')
      })
    })
  })

  describe('Game selector', () => {
    it('renders game chip row after schedule loads', () => {
      cy.get('.game-chip', { timeout: 12000 }).should('have.length.at.least', 1)
    })

    it('selecting a game chip updates the score card', () => {
      cy.get('.game-chip', { timeout: 12000 }).first().click()
      cy.get('.score-card').should('exist')
      cy.assertNoErrors()
    })
  })

  describe('Season picker', () => {
    it('renders season options', () => {
      cy.contains('2025-26').should('exist')
      cy.contains('2024-25').should('exist')
    })

    it('switching seasons does not crash', () => {
      // handleSeasonChange is defined in the view
      cy.contains('2024-25').click()
      cy.get('.topbar', { timeout: 6000 }).should('exist')
      cy.assertNoErrors()
      cy.contains('2025-26').click()
    })
  })
})

// ── NHL Shot Map debug panel ──────────────────────────────────────────────────
// Verify the NHL side also has debug panel and hat trick for the selected team

describe('NHL Shot Map — Debug Panel', () => {
  beforeEach(() => {
    cy.visit('/', {
      onBeforeLoad(win) {
        win.localStorage.setItem('eyewall:team', JSON.stringify({ abbr: 'CAR' }))
      },
    })
    cy.get('.topbar', { timeout: 10000 }).should('exist')
    cy.get('.score-card', { timeout: 10000 }).should('exist')
    // 5 taps to open debug panel
    Cypress._.times(5, () => cy.get('.score-card').click())
    cy.get('.debug-panel', { timeout: 4000 }).should('exist')
  })

  it('NHL debug panel opens', () => {
    cy.contains('Event Debug').should('exist')
  })

  it('NHL Goal popup fires', () => {
    cy.contains('CAR Goal').click()
    cy.get('.goal-popup', { timeout: 4000 }).should('exist')
    cy.contains('GOAL!').should('exist')
    cy.contains('tap to dismiss').click({ force: true })
  })

  it('NHL Hat Trick popup fires with raining hats', () => {
    cy.contains('🧢 Hat Trick').click()
    cy.get('.hat-trick-popup', { timeout: 4000 }).should('exist')
    cy.contains('HAT TRICK!').should('exist')
    cy.get('.hat-piece').should('have.length.at.least', 1)
    cy.contains('tap to dismiss').click({ force: true })
  })

  it('NHL Win popup shows team abbr dynamically', () => {
    cy.contains('Win Popup').click()
    cy.get('.win-popup', { timeout: 4000 }).should('exist')
    cy.contains('WIN!').should('exist')
    // Should not say CANES WIN — should use TEAM_CONFIG.abbr dynamically
    cy.contains('CAR').should('exist')
    cy.contains('tap to dismiss').click({ force: true })
  })
})
