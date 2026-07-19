// cypress/e2e/player-search.cy.js
// Global player search (Session 60) — Fuse.js fuzzy match across NHL +
// PWHL against the Worker's GET /players-search-index, opening the
// sport-appropriate popup (both self-fetch by id, so no pre-merge is
// needed here — see PlayerSearch.jsx).

const WORKER_URL_PLAYER_SEARCH = Cypress.env('VITE_WORKER_URL') || 'https://eyewall-poller.billowing-queen-bf23.workers.dev'

describe('Global player search', () => {
  beforeEach(() => {
    cy.visit('/')
    cy.get('.topbar', { timeout: 10000 }).should('exist')
  })

  it('search icon opens the panel with a focused input', () => {
    cy.get('.player-search-toggle').click()
    cy.get('.player-search-input', { timeout: 6000 }).should('be.visible').and('have.focus')
  })

  it('typing fewer than 2 characters shows no results', () => {
    cy.get('.player-search-toggle').click()
    cy.get('.player-search-input').type('m')
    cy.get('.player-search-result').should('not.exist')
  })

  it('closes when clicking outside the panel', () => {
    cy.get('.player-search-toggle').click()
    cy.get('.player-search-panel').should('exist')
    cy.get('body').click(0, 0)
    cy.get('.player-search-panel').should('not.exist')
  })

  it('closes on Escape', () => {
    cy.get('.player-search-toggle').click()
    cy.get('.player-search-input').type('{esc}')
    cy.get('.player-search-panel').should('not.exist')
  })

  it('shows a no-results message for a nonsense query', () => {
    cy.get('.player-search-toggle').click()
    cy.get('.player-search-input').type('zzqxnonexistentplayer')
    cy.contains(/No players found/i, { timeout: 8000 }).should('exist')
  })

  describe('NHL result correctness', () => {
    it('finds a well-known NHL player with correct team/position/sport badge', () => {
      cy.get('.player-search-toggle').click()
      cy.get('.player-search-input').type('mcdavid')
      cy.contains('.player-search-result', 'Connor McDavid', { timeout: 8000 }).within(() => {
        cy.contains('EDM').should('exist')
        cy.contains('NHL').should('exist')
      })
    })

    it('opens the NHL player popup on selection, self-fetched stats included', () => {
      cy.get('.player-search-toggle').click()
      cy.get('.player-search-input').type('mcdavid')
      cy.contains('.player-search-result', 'Connor McDavid', { timeout: 8000 }).click()
      cy.get('.player-popup', { timeout: 10000 }).should('exist')
      cy.contains('McDavid').should('exist')
      cy.contains('Goals', { timeout: 8000 }).should('exist')
      cy.get('.pp-close').click()
      cy.get('.player-popup').should('not.exist')
    })

    // Deterministic (mocked), unlike the two tests above which assert
    // against live production data -- the fallback-flagged state only
    // exists in real data during the window right after a season flip
    // (Session 66), so it can't be a reliable permanent live assertion.
    // Asserts the SPECIFIC resolved team, not just that the badge is
    // non-empty -- "shows *a* team" would pass even if the fallback picked
    // the wrong season or a stale value silently indistinguishable from
    // a confirmed-current one.
    it('flags a team resolved from the season-back fallback as stale, not as current fact', () => {
      cy.intercept('GET', `${WORKER_URL_PLAYER_SEARCH}/players-search-index`, {
        body: [
          { id: 8478402, name: 'Connor McDavid', team: 'EDM', teamStale: true, teamSeason: '20242025', position: 'C', sport: 'nhl' },
        ],
      }).as('getSearchIndex')
      cy.get('.player-search-toggle').click()
      cy.get('.player-search-input').type('mcdavid')
      cy.wait('@getSearchIndex')
      cy.contains('.player-search-result', 'Connor McDavid', { timeout: 8000 }).within(() => {
        cy.get('.psr-team')
          .should('have.class', 'psr-team--stale')
          .and('contain', 'EDM')
          .and('have.attr', 'title', 'As of 2024-25 season')
      })
    })

    it('shows an explicit no-team state, distinct from the stale case, when neither season has data', () => {
      cy.intercept('GET', `${WORKER_URL_PLAYER_SEARCH}/players-search-index`, {
        body: [
          { id: 9999999, name: 'Brand New Rookie', team: null, position: 'C', sport: 'nhl' },
        ],
      }).as('getSearchIndex')
      cy.get('.player-search-toggle').click()
      cy.get('.player-search-input').type('brand new rookie')
      cy.wait('@getSearchIndex')
      cy.contains('.player-search-result', 'Brand New Rookie', { timeout: 8000 }).within(() => {
        cy.get('.psr-team')
          .should('not.have.class', 'psr-team--stale')
          .and('contain', '—')
          .and('have.attr', 'title', 'No team assigned yet')
      })
    })
  })

  describe('PWHL result correctness', () => {
    it('finds a well-known PWHL player with correct sport badge', () => {
      cy.get('.player-search-toggle').click()
      cy.get('.player-search-input').type('poulin')
      cy.contains('.player-search-result', 'Marie-Philip Poulin', { timeout: 8000 }).within(() => {
        cy.contains('PWHL').should('exist')
      })
    })

    it('opens the PWHL player popup on selection, self-fetched stats included', () => {
      cy.get('.player-search-toggle').click()
      cy.get('.player-search-input').type('poulin')
      cy.contains('.player-search-result', 'Marie-Philip Poulin', { timeout: 8000 }).click()
      cy.get('.popup-backdrop', { timeout: 10000 }).should('exist')
      cy.contains('Poulin').should('exist')
      cy.contains('Goals', { timeout: 8000 }).should('exist')
      cy.get('.pp-close').click()
      cy.get('.popup-backdrop').should('not.exist')
    })
  })

  describe('Typo tolerance', () => {
    it('tolerates a dropped-letter misspelling of a well-known surname', () => {
      cy.get('.player-search-toggle').click()
      cy.get('.player-search-input').type('crosbey')
      cy.contains('.player-search-result', 'Sidney Crosby', { timeout: 8000 }).should('exist')
    })

    it('tolerates first+last name typed in full', () => {
      cy.get('.player-search-toggle').click()
      cy.get('.player-search-input').type('sid crosby')
      cy.contains('.player-search-result', 'Sidney Crosby', { timeout: 8000 }).should('exist')
    })

    it('tolerates a dropped-letter misspelling of a PWHL surname', () => {
      cy.get('.player-search-toggle').click()
      cy.get('.player-search-input').type('woszniewicz')
      cy.contains('.player-search-result', 'Sarah Wozniewicz', { timeout: 8000 }).should('exist')
    })
  })
})
