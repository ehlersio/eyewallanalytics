// cypress/e2e/period-summary.cy.js
// Tests for the Period Summary / Game Center feature
// Requires a completed game in sessionStorage (built automatically from PBP on load)

describe('Game Center (⚡ button)', () => {
  beforeEach(() => {
    cy.visit('/')
    // Clear stale summaries so they rebuild cleanly
    cy.window().then(win => win.sessionStorage.clear())
    cy.visit('/')
    cy.contains('CAR', { timeout: 10000 }).should('exist')
  })

  it('renders the Game Center button in the topbar', () => {
    cy.get('button.notif-bell').should('exist')
    cy.get('button.notif-bell').should('contain', '⚡')
  })

  it('opens the Game Center drawer on click', () => {
    cy.get('button.notif-bell').click()
    cy.get('.notif-popup').should('be.visible')
    cy.contains('⚡ Game Center').should('exist')
  })

  it('drawer shows push notification toggle section', () => {
    cy.get('button.notif-bell').click()
    cy.contains(/Push Notifications/i).should('exist')
    cy.contains(/Turn on notifications|Turn off notifications|Notifications blocked/i).should('exist')
  })

  it('closes the drawer when X is clicked', () => {
    cy.get('button.notif-bell').click()
    cy.get('.notif-popup').should('be.visible')
    cy.get('.notif-close').click()
    cy.get('.notif-popup').should('not.exist')
  })

  describe('Period Summaries section', () => {
    it('shows period chips after summaries load', () => {
      // Summaries build from PBP — wait for them
      cy.get('button.notif-bell').click()
      // Allow up to 15s for async summary build + landing fetch
      cy.contains(/P1|P2|P3|FINAL/, { timeout: 15000 }).should('exist')
    })

    it('period chips show period label and goal score', () => {
      cy.get('button.notif-bell').click()
      cy.get('.notif-summary-chip', { timeout: 15000 }).should('have.length.greaterThan', 0)
      cy.get('.notif-summary-chip').first().within(() => {
        cy.get('.notif-summary-chip-period').should('exist')
        cy.get('.notif-summary-chip-score').should('exist')
      })
    })

    it('FINAL chip is styled distinctly', () => {
      cy.get('button.notif-bell').click()
      cy.get('.notif-summary-chip-game', { timeout: 15000 }).should('exist')
      cy.get('.notif-summary-chip-game .notif-summary-chip-period').should('contain', 'FINAL')
    })
  })
})

describe('Period Summary popup', () => {
  beforeEach(() => {
    cy.visit('/')
    cy.window().then(win => win.sessionStorage.clear())
    cy.visit('/')
    cy.contains('CAR', { timeout: 10000 }).should('exist')
    // Open Game Center and click first period chip
    cy.get('button.notif-bell').click()
    cy.get('.notif-summary-chip', { timeout: 15000 }).first().click()
    cy.get('.ps-card', { timeout: 5000 }).should('exist')
  })

  it('shows period badge in header', () => {
    cy.get('.ps-period-badge').should('exist')
  })

  it('shows score banner with team abbreviations', () => {
    cy.get('.ps-score-banner').should('exist')
    cy.get('.ps-team-abbr').should('have.length.greaterThan', 0)
    cy.get('.ps-score-num').should('have.length', 2)
  })

  it('shows team logos', () => {
    cy.get('.ps-team-logo').should('have.length', 2)
  })

  it('shows stat grid with 6 cells', () => {
    cy.get('.ps-stat-grid').should('exist')
    cy.get('.ps-stat-cell').should('have.length', 6)
  })

  it('stat grid shows CF%, SOG, FF%, Hits, Faceoff%, HD Chances', () => {
    cy.contains('CAR Corsi For%').should('exist')
    cy.contains('Shots on Goal').should('exist')
    cy.contains('CAR Fenwick For%').should('exist')
    cy.contains('CAR Hits').should('exist')
    cy.contains('Faceoff Win%').should('exist')
    cy.contains('High Danger Chances').should('exist')
  })

  it('shows EyeWall AI section', () => {
    cy.contains('EyeWall AI').should('exist')
    cy.get('.ps-narrative').should('exist')
  })

  it('AI narrative loads within 15 seconds', () => {
    cy.get('.ps-narrative-text', { timeout: 15000 }).should('exist')
    cy.get('.ps-narrative-loading').should('not.exist')
  })

  it('shows penalties section when penalties exist', () => {
    // Not all periods have penalties — check conditionally
    cy.get('body').then($body => {
      if ($body.find('.ps-penalties').length) {
        cy.get('.ps-penalty-row').should('have.length.greaterThan', 0)
        // Each row should have team badge + player name
        cy.get('.ps-penalty-team').should('exist')
        cy.get('.ps-penalty-player').should('exist')
      }
    })
  })

  it('collapses penalties beyond 3 with show more toggle', () => {
    cy.get('body').then($body => {
      if ($body.find('.ps-penalties-toggle').length) {
        cy.get('.ps-penalties-toggle').should('contain', 'Show')
        cy.get('.ps-penalties-toggle').click()
        cy.get('.ps-penalties-toggle').should('contain', 'Show less')
      }
    })
  })

  it('shows goals section with carousel when goals exist', () => {
    cy.get('body').then($body => {
      if ($body.find('.ps-carousel').length) {
        cy.get('.ps-carousel').should('exist')
        cy.get('.ps-carousel-dots').should('exist')
        cy.get('.ps-goal-card').should('exist')
        cy.get('.ps-goal-scorer').should('exist')
      }
    })
  })

  it('carousel navigation arrows work', () => {
    cy.get('body').then($body => {
      if ($body.find('.ps-carousel').length) {
        const dots = $body.find('.ps-carousel-dot').length
        if (dots > 1) {
          cy.get('.ps-carousel-arrow').last().click()
          cy.get('.ps-carousel-counter').should('contain', '2 /')
        }
      }
    })
  })

  it('shows Save Image and Copy Caption buttons', () => {
    cy.get('.ps-share-section').should('exist')
    cy.contains('Save Image').should('exist')
    cy.contains('Copy Caption').should('exist')
  })

  it('closes when X button is clicked', () => {
    cy.get('.ps-header .ps-btn-icon').click()
    cy.get('.ps-card').should('not.exist')
  })
})

describe('Final Game Summary popup', () => {
  beforeEach(() => {
    cy.visit('/')
    cy.window().then(win => win.sessionStorage.clear())
    cy.visit('/')
    cy.contains('CAR', { timeout: 10000 }).should('exist')
    // Open Game Center and click the FINAL chip
    cy.get('button.notif-bell').click()
    cy.get('.notif-summary-chip-game', { timeout: 15000 }).click()
    cy.get('.ps-card', { timeout: 5000 }).should('exist')
  })

  it('shows FINAL badge', () => {
    cy.get('.ps-period-badge').should('contain', 'FINAL')
  })

  it('shows period breakdown section', () => {
    cy.get('.ps-period-breakdown', { timeout: 8000 }).should('exist')
    cy.get('.ps-period-row').should('have.length.greaterThan', 0)
  })

  it('period breakdown shows CF% per period', () => {
    cy.get('.ps-period-row-pct').should('have.length.greaterThan', 0)
    cy.get('.ps-period-row-pct').first().invoke('text').should('match', /\d+%/)
  })

  it('shows three stars section', () => {
    cy.contains('Three Stars', { timeout: 8000 }).should('exist')
    cy.get('.ps-star-card').should('have.length', 3)
    cy.get('.ps-star-name').should('have.length', 3)
  })

  it('goals section is labeled Goals not Goals This Period', () => {
    cy.get('body').then($body => {
      if ($body.find('.ps-goals').length) {
        cy.get('.ps-section-label').contains(/Goals \(\d+\)/).should('exist')
      }
    })
  })

  it('shows all goals not just first 4', () => {
    cy.get('body').then($body => {
      if ($body.find('.ps-goals').length) {
        // Game had 9 goals — all should be accessible via carousel
        cy.get('.ps-carousel-dot').should('have.length.greaterThan', 3)
      }
    })
  })
})
