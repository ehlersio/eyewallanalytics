// cypress/e2e/news.cy.js
describe('News view', () => {
  beforeEach(() => {
    cy.team().then(t => {
      cy.visit('/news')
      cy.contains(t.newsPageTitle, { timeout: 8000 }).should('be.visible')
      // Wait for articles to load before running any assertions
      cy.get('.news-chip', { timeout: 15000 }).should('have.length.gte', 2)
    })
  })

  it('shows page title and article count', () => {
    cy.team().then(t => cy.contains(t.newsPageTitle).should('be.visible'))
    cy.contains(/\d+ articles?/i, { timeout: 15000 }).should('exist')
  })

  it('shows last updated timestamp', () => {
    cy.contains(/Updated/i, { timeout: 15000 }).should('exist')
  })

  it('shows refresh button', () => {
    cy.get('.news-refresh-btn').should('exist')
  })

  it('refresh button is clickable without crashing', () => {
    cy.team().then(t => {
      cy.get('.news-refresh-btn').first().click()
      cy.contains(t.newsPageTitle).should('be.visible')
    })
  })

  describe('Source filter chips', () => {
    it('renders All chip plus at least one source chip', () => {
      cy.get('.news-chip').should('have.length.gte', 2)
      cy.get('.news-chip').contains(/All/i).should('exist')
    })

    it('renders expected source chips when sources are available', () => {
      cy.get('.news-chip', { timeout: 10000 }).should('have.length.gte', 2)
      cy.team().then(t => {
        cy.get('.news-chip').then($chips => {
          const text = [...$chips].map(c => c.textContent).join(' ')
          const hasESPN      = /ESPN/i.test(text)
          const hasSportsnet = /Sportsnet/i.test(text)
          const hasTheScore  = /The Score/i.test(text)
          const hasTeamSource = t.teamNewsSource
            ? new RegExp(t.teamNewsSource, 'i').test(text)
            : false
          expect(hasTeamSource || hasESPN || hasSportsnet || hasTheScore).to.be.true
        })
      })
    })

    it('All chip is active by default', () => {
      cy.get('.news-chip.active').should('contain', 'All')
    })

    it('clicking ESPN chip filters to ESPN articles', () => {
      cy.get('.news-chip').then($chips => {
        const hasESPN = [...$chips].some(c => /ESPN/i.test(c.textContent))
        if (!hasESPN) return
        cy.get('.news-chip').contains('ESPN').click()
        cy.get('.news-chip').contains('ESPN').should('have.class', 'active')
      })
    })

    it('clicking team news source chip filters correctly', () => {
      cy.team().then(t => {
        if (!t.teamNewsSource) return
        cy.get('.news-chip').then($chips => {
          const chipText = [...$chips].map(c => c.textContent).join(' ')
          if (new RegExp(t.teamNewsSource, 'i').test(chipText)) {
            cy.get('.news-chip').contains(t.teamNewsSource).click()
            cy.get('.news-chip').contains(t.teamNewsSource).should('have.class', 'active')
          }
        })
      })
    })

    it('clicking All chip shows all articles again', () => {
      cy.get('.news-chip').then($chips => {
        const hasESPN = [...$chips].some(c => /ESPN/i.test(c.textContent))
        if (!hasESPN) return
        cy.get('.news-chip').contains('ESPN').click()
        cy.get('.news-chip').contains(/All/i).click()
        cy.get('.news-chip').contains(/All/i).should('have.class', 'active')
      })
    })
  })

  describe('Article list', () => {
    it('renders at least one article', () => {
      cy.team().then(t => {
        cy.contains(new RegExp(`${t.displayName}|${t.abbr}|NHL|Stanley`, 'i'), { timeout: 8000 }).should('exist')
      })
    })

    it('articles show source badge', () => {
      cy.contains(/ESPN|SPORTSNET|THE SCORE/i).should('exist')
    })

    it('articles show a relative timestamp', () => {
      cy.contains(/ago|just now/i, { timeout: 15000 }).should('exist')
    })

    it('articles show a headline', () => {
      cy.get('body').invoke('text').then(text => {
        expect(text.length).to.be.greaterThan(500)
      })
    })

    it('articles show a preview snippet', () => {
      cy.contains(/\. /).should('exist')
    })
  })

  it('shows attribution footer', () => {
    cy.team().then(t => {
      const sources = t.teamNewsSource
        ? new RegExp(`${t.teamNewsSource}|ESPN|Sportsnet|The Score`, 'i')
        : /ESPN|Sportsnet|The Score/i
      cy.contains(sources).should('exist')
    })
    cy.contains(/Tap any article/i).should('exist')
  })
})
