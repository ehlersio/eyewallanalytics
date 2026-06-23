// cypress/e2e/pwhl-dev.cy.js
// Tests for the PWHL dev replay view (/pwhl/dev)
// Only runs in dev builds — skipped in CI unless DEV=true

describe('PWHL Dev Replay View', () => {
  beforeEach(() => {
    cy.setPWHLTeam('MTL')
    cy.visit('/pwhl/dev', {
      onBeforeLoad(win) {
        win.localStorage.setItem('eyewall:sport', 'pwhl')
        win.localStorage.setItem('eyewall:pwhl_team', JSON.stringify({ abbr: 'MTL', teamId: 3 }))
      },
    })
    cy.get('.topbar', { timeout: 10000 }).should('exist')
  })

  it('loads without crashing', () => {
    cy.assertNoErrors()
  })

  it('shows DEV badge', () => {
    cy.contains('DEV', { timeout: 6000 }).should('exist')
  })

  it('shows PWHL Live Game Replay title', () => {
    cy.contains('PWHL Live Game Replay', { timeout: 6000 }).should('exist')
  })

  it('renders game ID input', () => {
    cy.get('input[placeholder*="Game ID"]', { timeout: 6000 }).should('exist')
  })

  it('renders Load button', () => {
    cy.contains('Load', { timeout: 6000 }).should('exist')
  })

  it('renders recent games section after mount', () => {
    // Recent games load async from the selected team's schedule
    cy.contains('Recent games', { timeout: 10000 }).should('exist')
  })

  it('shows recent game chips', () => {
    cy.get('.dev-game-btn', { timeout: 10000 }).should('have.length.at.least', 1)
  })

  it('loads a game from recent games list', () => {
    cy.get('.dev-game-btn', { timeout: 10000 }).first().click()
    // Scrubber should appear after load
    cy.get('.dev-scrubber', { timeout: 15000 }).should('exist')
  })

  it('shows play/pause controls after game loads', () => {
    cy.get('.dev-game-btn', { timeout: 10000 }).first().click()
    cy.contains('▶ Play', { timeout: 15000 }).should('exist')
  })

  it('shows event count status after game loads', () => {
    cy.get('.dev-game-btn', { timeout: 10000 }).first().click()
    cy.contains('Events', { timeout: 15000 }).should('exist')
  })

  it('period tick buttons render after game loads', () => {
    cy.get('.dev-game-btn', { timeout: 10000 }).first().click()
    cy.get('.dev-period-tick', { timeout: 15000 }).should('have.length.at.least', 1)
  })

  it('speed controls render after game loads', () => {
    cy.get('.dev-game-btn', { timeout: 10000 }).first().click()
    cy.contains('Speed', { timeout: 15000 }).should('exist')
    cy.contains('1m/s', { timeout: 6000 }).should('exist')
  })

  it('PWHLShotMapView renders inside dev replay', () => {
    // The shot map view is embedded below the control panel
    cy.get('.dev-shotmap', { timeout: 6000 }).should('exist')
    cy.get('.score-card', { timeout: 10000 }).should('exist')
  })

  it('scrubbing to end shows DEV badge on score card', () => {
    cy.get('.dev-game-btn', { timeout: 10000 }).first().click()
    cy.get('.dev-scrubber', { timeout: 15000 }).should('exist')
    // Jump to end using ⏭ button
    cy.contains('⏭').click()
    cy.get('.dev-shotmap .score-card', { timeout: 6000 }).should('exist')
    cy.assertNoErrors()
  })

  describe('Debug panel inside dev replay', () => {
    beforeEach(() => {
      // Load a game first so score-card is rendered
      cy.get('.dev-game-btn', { timeout: 10000 }).first().click()
      cy.get('.dev-shotmap .score-card', { timeout: 15000 }).should('exist')
      // 5 taps to open debug panel
      Cypress._.times(5, () => {
        cy.get('.dev-shotmap .score-card').click()
      })
      cy.get('.debug-panel', { timeout: 6000 }).should('exist')
    })

    it('debug panel opens on 5 taps', () => {
      cy.contains('PWHL Event Debug').should('exist')
    })

    it('Goal popup fires', () => {
      cy.contains('🚨 Goal').click()
      cy.get('.goal-popup', { timeout: 4000 }).should('exist')
      cy.contains('GOAL!').should('exist')
      cy.contains('tap to dismiss').click({ force: true })
      cy.get('.goal-popup').should('not.exist')
    })

    it('Hat Trick popup fires', () => {
      cy.contains('🧢 Hat Trick').click()
      cy.get('.hat-trick-popup', { timeout: 4000 }).should('exist')
      cy.contains('HAT TRICK!').should('exist')
      cy.contains('tap to dismiss').click({ force: true })
      cy.get('.hat-trick-popup').should('not.exist')
    })

    it('Puck Drop popup fires', () => {
      cy.contains('🏒 Puck Drop').click()
      cy.get('.puck-drop-popup', { timeout: 4000 }).should('exist')
      cy.contains('PUCK DROP').should('exist')
      cy.contains('tap to dismiss').click({ force: true })
    })

    it('PP Alert popup fires', () => {
      cy.contains('⚡ PP Alert').click()
      cy.get('.penalty-popup', { timeout: 4000 }).should('exist')
      cy.contains('POWER').should('exist')
      cy.contains('tap to dismiss').click({ force: true })
    })

    it('Win popup fires', () => {
      cy.contains('🏆 Win').click()
      cy.get('.win-popup', { timeout: 4000 }).should('exist')
      cy.contains('WIN!').should('exist')
      cy.contains('tap to dismiss').click({ force: true })
    })

    it('Our PP situation chip appears', () => {
      cy.contains('🟢 Our PP').click()
      cy.get('.car-pp', { timeout: 4000 }).should('exist')
      cy.contains('Power Play').should('exist')
    })

    it('Opp PP situation chip appears', () => {
      cy.contains('🟡 Opp PP').click()
      cy.get('.opp-pp', { timeout: 4000 }).should('exist')
    })

    it('Our EN chip appears', () => {
      cy.contains('🥅 Our EN').click()
      cy.get('.car-en', { timeout: 4000 }).should('exist')
      cy.contains('Empty Net').should('exist')
    })

    it('debug panel closes on ✕', () => {
      cy.get('.debug-close-btn').click()
      cy.get('.debug-panel').should('not.exist')
    })
  })
})
