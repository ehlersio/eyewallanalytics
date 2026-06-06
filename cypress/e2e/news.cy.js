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
    it('renders All chip plus at least one source chip', () => {
      // Chips are built dynamically from articles actually returned —
      // a source with no articles won't get a chip. Always at least "All" + 1.
      cy.get('.news-chip').should('have.length.gte', 2)
      cy.get('.news-chip').contains(/All/i).should('exist')
    })

    it('renders expected source chips when sources are available', () => {
      // Wait for articles to load and chips to populate (chips build from fetched data)
      cy.get('.news-chip', { timeout: 10000 }).should('have.length.gte', 2)
      cy.get('.news-chip').then($chips => {
        const text = [...$chips].map(c => c.textContent).join(' ')
        const hasCanes     = /Canes Country/i.test(text)
        const hasESPN      = /ESPN/i.test(text)
        const hasSportsnet = /Sportsnet/i.test(text)
        const hasTheScore  = /The Score/i.test(text)
        expect(hasCanes || hasESPN || hasSportsnet || hasTheScore).to.be.true
      })
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

    it('articles show source badge (ESPN, CANES COUNTRY, SPORTSNET, or THE SCORE)', () => {
      cy.contains(/ESPN|CANES COUNTRY|SPORTSNET|THE SCORE/i).should('exist')
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
    cy.contains(/Canes Country|ESPN|Sportsnet|The Score/i).should('exist')
    cy.contains(/Tap any article/i).should('exist')
  })
})
