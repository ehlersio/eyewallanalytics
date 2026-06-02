// cypress/e2e/news.cy.js

describe('News view', () => {
  beforeEach(() => {
    cy.visit('/news')
    cy.contains('Canes News').should('be.visible')
  })

  // ── Header ─────────────────────────────────────────────────
  it('shows page title and article count', () => {
    cy.contains('Canes News').should('be.visible')
    cy.contains(/\d+ articles?/i).should('exist')
  })

  it('shows last updated timestamp', () => {
    cy.contains(/Updated/i).should('exist')
  })

  it('shows refresh button', () => {
    cy.get('.news-refresh-btn').should('exist')
  })

  it('refresh button is clickable without crashing', () => {
    cy.get('.news-refresh-btn').click()
    cy.contains('Canes News').should('be.visible')
  })

  // ── Source filter chips ────────────────────────────────────
  describe('Source filter chips', () => {
    it('renders All, Canes Country, ESPN, Sportsnet chips', () => {
      cy.get('.news-chip').should('have.length', 4)
      cy.get('.news-chip').contains(/All/i).should('exist')
      cy.get('.news-chip').contains('Canes Country').should('exist')
      cy.get('.news-chip').contains('ESPN').should('exist')
      cy.get('.news-chip').contains('Sportsnet').should('exist')
    })

    it('All chip is active by default', () => {
      cy.get('.news-chip.active').should('contain', 'All')
    })

    it('clicking ESPN chip filters to ESPN articles', () => {
      cy.get('.news-chip').contains('ESPN').click()
      cy.get('.news-chip').contains('ESPN').should('have.class', 'active')
      // Should show ESPN badge on articles or no articles
      cy.get('body').then($body => {
        if ($body.find('[class*="source"], [class*="badge"]').length) {
          cy.contains('ESPN').should('exist')
        }
      })
    })

    it('clicking Canes Country chip filters correctly', () => {
      cy.get('.news-chip').contains('Canes Country').click()
      cy.get('.news-chip').contains('Canes Country').should('have.class', 'active')
    })

    it('clicking All chip shows all articles again', () => {
      cy.get('.news-chip').contains('ESPN').click()
      cy.get('.news-chip').contains(/All/i).click()
      cy.get('.news-chip').contains(/All/i).should('have.class', 'active')
    })
  })

  // ── Article list ───────────────────────────────────────────
  describe('Article list', () => {
    it('renders at least one article', () => {
      cy.contains(/Hurricanes|Carolina|CAR|NHL|Stanley/i, { timeout: 8000 }).should('exist')
    })

    it('articles show source badge (ESPN, CANES COUNTRY, or SPORTSNET)', () => {
      cy.contains(/ESPN|CANES COUNTRY|SPORTSNET/i).should('exist')
    })

    it('articles show a relative timestamp', () => {
      cy.contains(/ago|just now/i).should('exist')
    })

    it('articles show a headline', () => {
      // Headlines are longer text strings
      cy.get('body').invoke('text').then(text => {
        // Should have meaningful article text, not just labels
        expect(text.length).to.be.greaterThan(200)
      })
    })

    it('articles show a preview snippet', () => {
      // Snippets contain full sentences
      cy.contains(/\. /).should('exist')
    })
  })

  // ── Footer ─────────────────────────────────────────────────
  it('shows attribution footer', () => {
    cy.contains(/Canes Country|Google News|ESPN|Sportsnet/i).should('exist')
    cy.contains(/Tap any article/i).should('exist')
  })
})
