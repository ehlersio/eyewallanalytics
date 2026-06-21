// cypress/e2e/pwhl-news.cy.js
const WORKER_URL = Cypress.env('WORKER_URL') || 'https://eyewall-poller.billowing-queen-bf23.workers.dev'

describe('PWHL News view', () => {
  before(() => {
    // Prime the Worker cache before tests — covers cold-cache 4s retry
    const prime = (attempts) => {
      cy.request({ url: `${WORKER_URL}/pwhl/news`, failOnStatusCode: false })
        .then(res => {
          const articles = Array.isArray(res.body) ? res.body : []
          if (articles.length === 0 && attempts > 0) {
            cy.wait(4000)
            prime(attempts - 1)
          }
        })
    }
    prime(5)
  })

  beforeEach(() => {
    cy.setPWHLTeam('BOS')
    cy.visit('/pwhl/news')
    cy.contains('PWHL News', { timeout: 15000 }).should('be.visible')
    cy.get('.news-chip', { timeout: 20000 }).should('have.length.gte', 1)
  })

  it('shows PWHL News title', () => {
    cy.contains('PWHL News').should('be.visible')
  })

  it('shows article count', () => {
    cy.contains(/\d+ articles?/i, { timeout: 15000 }).should('exist')
  })

  it('shows last updated timestamp', () => {
    cy.contains(/Updated/i, { timeout: 15000 }).should('exist')
  })

  it('shows refresh button', () => {
    cy.get('.news-refresh-btn').should('exist')
  })

  it('refresh button is clickable without crashing', () => {
    cy.get('.news-refresh-btn').first().click()
    cy.contains('PWHL News').should('be.visible')
    cy.assertNoErrors()
  })

  describe('Source filter chips', () => {
    it('renders All chip plus at least one source chip', () => {
      cy.get('.news-chip', { timeout: 10000 }).should('have.length.gte', 1)
      cy.get('.news-chip').contains(/All/i).should('exist')
    })

    it('shows PWHL source chip when articles loaded', () => {
      cy.get('.news-chip').then($chips => {
        if ($chips.length < 2) return // cache cold — skip source check
        const text = [...$chips].map(c => c.textContent).join(' ')
        const hasSource = /PWHL|ESPN|IIHF|Sportsnet/i.test(text)
        expect(hasSource).to.be.true
      })
    })

    it('All chip is active by default', () => {
      cy.get('.news-chip.active').should('contain', 'All')
    })

    it('clicking a source chip filters articles', () => {
      cy.get('.news-chip').not(':contains("All")').first().click()
      cy.get('.news-chip.active').should('not.contain', 'All')
      cy.assertNoErrors()
    })

    it('clicking All chip restores all articles', () => {
      cy.get('.news-chip').not(':contains("All")').first().click()
      cy.get('.news-chip').contains(/All/i).click()
      cy.get('.news-chip').contains(/All/i).should('have.class', 'active')
    })
  })

  describe('Article list', () => {
    it('renders at least one article card', () => {
      cy.get('.news-card', { timeout: 15000 }).should('have.length.greaterThan', 0)
    })

    it('articles show a source badge', () => {
      cy.get('.news-source-badge', { timeout: 8000 }).should('exist')
    })

    it('articles show a relative timestamp', () => {
      cy.contains(/ago|just now/i, { timeout: 15000 }).should('exist')
    })

    it('articles show headlines', () => {
      cy.get('.news-card-title', { timeout: 8000 }).should('have.length.greaterThan', 0)
    })
  })

  it('shows attribution footer', () => {
    cy.contains(/PWHL|ESPN|Sportsnet|IIHF/i).should('exist')
    cy.contains(/Tap any article/i).should('exist')
  })
})
