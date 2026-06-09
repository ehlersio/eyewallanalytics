// cypress/e2e/viewports.cy.js
const VIEWPORTS = [
  { label: 'Mobile S',  width: 375,  height: 812  },
  { label: 'Mobile L',  width: 430,  height: 932  },
  { label: 'Tablet',    width: 768,  height: 1024 },
  { label: 'Desktop',   width: 1280, height: 800  },
]

VIEWPORTS.forEach(({ label, width, height }) => {
  describe(`Viewport: ${label} (${width}×${height})`, () => {
    beforeEach(() => cy.viewport(width, height))

    it('every route loads and renders key content', () => {
      cy.team().then(t => {
        const routes = [
          { path: '/',         checks: [t.abbr, /FINAL|LIVE|P[123]|OT/i] },
          { path: '/schedule', checks: [t.abbr, /W|L/] },
          { path: '/players',  checks: ['Forwards', t.skater] },
          { path: '/team',     checks: [t.displayName, 'Overview'] },
          { path: '/news',     checks: ['EyeWall Analytics'] },
        ]
        routes.forEach(({ path, checks }) => {
          cy.visit(path)
          checks.forEach(check => cy.contains(check, { timeout: 8000 }).should('exist'))
          cy.get('body').should('not.contain', 'Something went wrong')
        })
      })
    })

    it('bottom nav is accessible', () => {
      cy.visit('/')
      const tabs = ['Shot Map', 'Schedule', 'Players', 'Team', 'News']
      tabs.forEach(tab => cy.contains(tab).should('exist'))
    })

    it('no horizontal overflow on Shot Map', () => {
      cy.visit('/')
      cy.window().then(win => {
        expect(win.document.documentElement.scrollWidth)
          .to.be.lte(win.innerWidth + 2)
      })
    })

    it('no horizontal overflow on Players', () => {
      cy.visit('/players')
      cy.contains('Forwards', { timeout: 8000 }).should('exist')
      cy.window().then(win => {
        expect(win.document.documentElement.scrollWidth)
          .to.be.lte(win.innerWidth + 2)
      })
    })

    it('no horizontal overflow on Team', () => {
      cy.team().then(t => {
        cy.visit('/team')
        cy.contains(t.displayName, { timeout: 8000 }).should('exist')
        cy.window().then(win => {
          expect(win.document.documentElement.scrollWidth)
            .to.be.lte(win.innerWidth + 2)
        })
      })
    })

    it('Team tabs are clickable', () => {
      cy.team().then(t => {
        cy.visit('/team')
        cy.contains(t.displayName, { timeout: 8000 }).should('exist')
        const tabs = ['Overview', 'Advanced', 'Splits', 'Trends']
        tabs.forEach(tab => {
          cy.contains(tab).should('exist').click()
          cy.get('body').should('not.contain', 'Something went wrong')
        })
      })
    })

    it('player card opens and shows content', () => {
      cy.team().then(t => {
        cy.visit('/players')
        cy.contains('Forwards', { timeout: 8000 }).should('exist')
        cy.contains(t.skater).first().click()
        cy.contains(/Cap Hit|AAV/i, { timeout: 8000 }).should('exist')
        cy.contains('Analytics').should('exist')
        cy.contains('Heat Map').should('exist')
      })
    })
  })
})
